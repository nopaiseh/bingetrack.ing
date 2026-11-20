import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaInput, PersonRef } from "@/lib/admin/media-form";
import { findMusicDuplicateId, isDuplicateMusicEntry } from "@/lib/music/dedupe";
import { resolveMusicCover } from "@/lib/music/resolve-cover";

const WRITE_ERROR = "保存失败，请检查字段或数据库配置后重试。";
const PERMISSION_ERROR = "没有写入权限，请检查站长账号配置。";
const RUNTIME_ERROR = "曲目时长须为 1–7200 秒的整数，或留空。";

function writeError(code?: string, message?: string) {
  if (code === "23505") return "同一专辑中已存在这个曲序，请更换曲序。";
  if (code === "23503" || code === "P0002") return "资料或所属专辑已不存在，请刷新后重试。";
  if (code === "42501") return PERMISSION_ERROR;
  if (code === "23514" || (message && /runtime|7200|Invalid numeric/i.test(message))) return RUNTIME_ERROR;
  return WRITE_ERROR;
}

function assertOk(error: { code?: string; message?: string } | null) {
  if (!error) return;
  throw new SaveMusicMediaError(writeError(error.code, error.message), error.code);
}

export class SaveMusicMediaError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "SaveMusicMediaError";
    this.code = code;
  }
}

function relatedOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** RPC 用的演职员：仅 id／name，避免把 character 传给非演员角色。 */
function creditPayload(people: PersonRef[]) {
  return people.map(({ id, name }) => ({ id, name }));
}

/** 组装 manage_save_media／admin_save_media 可接受的 jsonb 负载。 */
function mediaRpcPayload(payload: MediaInput) {
  return {
    id: payload.id,
    type: payload.type,
    title: payload.title,
    alternate_title: payload.alternate_title,
    summary: payload.summary,
    cover_url: payload.cover_url,
    release_date: payload.release_date,
    runtime: payload.runtime,
    parent_id: payload.parent_id,
    number: payload.number,
    status: payload.status === "watched" ? "watched" : "want_to_watch",
    rating: payload.rating,
    genres: payload.genres,
    languages: payload.languages,
    regions: payload.regions,
    actors: payload.actors,
    directors: payload.directors,
    artists: creditPayload(payload.artists),
    lyricists: creditPayload(payload.lyricists),
    composers: creditPayload(payload.composers),
    label: payload.label,
    collections: payload.collections ?? [],
  };
}

/**
 * 同一专辑内按规范化标题 + artist 集合查重（全库 RPC 对曲目过宽）。
 * 专辑仍走 findMusicDuplicateId。
 */
async function findDuplicateTrackInAlbum(
  db: SupabaseClient,
  albumId: string,
  title: string,
  artists: readonly string[],
  excludeId: string | null,
): Promise<string | null> {
  const { data: rows, error } = await db
    .from("music")
    .select("media_item_id, media:media_items!music_media_item_id_fkey(id, title)")
    .eq("album_id", albumId);
  assertOk(error);
  const candidates = (rows ?? [])
    .map((row) => {
      const media = relatedOne(row.media as { id: string; title: string } | { id: string; title: string }[] | null);
      return {
        id: row.media_item_id as string,
        title: media?.title ?? "",
      };
    })
    .filter((row) => row.id && row.id !== excludeId);
  if (candidates.length === 0) return null;

  const { data: creditRows, error: creditError } = await db
    .from("media_credits")
    .select("media_item_id, people(name)")
    .in(
      "media_item_id",
      candidates.map((row) => row.id),
    )
    .eq("role", "artist");
  assertOk(creditError);

  const artistsById = new Map<string, string[]>();
  for (const row of creditRows ?? []) {
    const mediaId = row.media_item_id as string;
    const person = relatedOne(row.people as { name: string } | { name: string }[] | null);
    const name = person?.name;
    if (!name) continue;
    const list = artistsById.get(mediaId) ?? [];
    list.push(name);
    artistsById.set(mediaId, list);
  }

  for (const candidate of candidates) {
    if (
      isDuplicateMusicEntry({
        title,
        artists,
        existingTitle: candidate.title,
        existingArtists: artistsById.get(candidate.id) ?? [],
      })
    ) {
      return candidate.id;
    }
  }
  return null;
}

type PrepareOptions = {
  /** 新建专辑＋曲目时，曲目所属专辑尚未入库，跳过存在性检查。 */
  skipAlbumExistsCheck?: boolean;
  /** 新建专辑时库中尚无曲目，跳过同专辑标题查重。 */
  skipTrackDedupe?: boolean;
};

async function prepareMusicPayload(
  db: SupabaseClient,
  payload: MediaInput,
  options: PrepareOptions = {},
): Promise<MediaInput> {
  if (payload.type !== "album" && payload.type !== "music") {
    throw new SaveMusicMediaError("只支持专辑与曲目。");
  }

  if (payload.type === "music") {
    if (payload.runtime != null && (payload.runtime < 1 || payload.runtime > 7200)) {
      throw new SaveMusicMediaError(RUNTIME_ERROR, "22023");
    }
    if (!options.skipAlbumExistsCheck) {
      const { data: album, error } = await db
        .from("media_items")
        .select("id")
        .eq("id", payload.parent_id)
        .eq("type", "album")
        .maybeSingle();
      assertOk(error);
      if (!album) throw new SaveMusicMediaError("所属专辑不存在。", "P0002");
    }
  }

  const artistNames = payload.artists.map((person) => person.name);
  if (payload.type === "album") {
    const duplicateId = await findMusicDuplicateId(db, {
      type: "album",
      title: payload.title,
      artists: artistNames,
    }).catch(() => null);
    if (duplicateId && duplicateId !== payload.id) {
      throw new SaveMusicMediaError("已存在同名同艺人的专辑。", "23505");
    }
  } else if (payload.parent_id && !options.skipTrackDedupe) {
    const duplicateId = await findDuplicateTrackInAlbum(db, payload.parent_id, payload.title, artistNames, payload.id);
    if (duplicateId) {
      throw new SaveMusicMediaError("已存在同名同艺人的曲目。", "23505");
    }
  }

  let coverUrl = payload.cover_url;
  if (!coverUrl) {
    coverUrl = await resolveMusicCover({
      title: payload.title,
      artist: artistNames[0] ?? null,
      entity: payload.type === "album" ? "album" : "song",
    }).catch(() => null);
  }

  return { ...payload, cover_url: coverUrl };
}

/**
 * 保存专辑或曲目。
 * 专辑走 admin_save_album_with_tracks；单曲走 admin_save_media。
 * 查重与封面解析仍在应用层；写入在单个数据库事务中完成。
 */
export async function saveMusicMedia(db: SupabaseClient, payload: MediaInput): Promise<string> {
  const prepared = await prepareMusicPayload(db, payload);

  if (prepared.type === "album") {
    const { data, error } = await db.rpc("admin_save_album_with_tracks", {
      p_album: mediaRpcPayload(prepared),
      p_tracks: [],
    });
    assertOk(error);
    if (!data) throw new SaveMusicMediaError(WRITE_ERROR);
    return String(data);
  }

  const { data, error } = await db.rpc("admin_save_media", { p_data: mediaRpcPayload(prepared) });
  assertOk(error);
  if (!data) throw new SaveMusicMediaError(WRITE_ERROR);
  return String(data);
}

/**
 * 在同一事务中保存专辑及其全部曲目；任一曲目失败则整笔回滚。
 * 曲目的 parent_id 由 RPC 覆盖为新专辑 id。
 */
export async function saveAlbumWithTracks(
  db: SupabaseClient,
  album: MediaInput,
  tracks: MediaInput[],
): Promise<string> {
  if (album.type !== "album") throw new SaveMusicMediaError("只支持专辑与曲目。");
  for (const track of tracks) {
    if (track.type !== "music") throw new SaveMusicMediaError("曲目列表只能包含 music 类型。");
  }

  const preparedAlbum = await prepareMusicPayload(db, album);
  const creatingAlbum = !preparedAlbum.id;
  const preparedTracks = [];
  for (const track of tracks) {
    preparedTracks.push(
      mediaRpcPayload(
        await prepareMusicPayload(
          db,
          {
            ...track,
            parent_id: preparedAlbum.id ?? track.parent_id,
          },
          {
            skipAlbumExistsCheck: creatingAlbum,
            skipTrackDedupe: creatingAlbum,
          },
        ),
      ),
    );
  }

  const { data, error } = await db.rpc("admin_save_album_with_tracks", {
    p_album: mediaRpcPayload(preparedAlbum),
    p_tracks: preparedTracks,
  });
  assertOk(error);
  if (!data) throw new SaveMusicMediaError(WRITE_ERROR);
  return String(data);
}

/** 删除曲目或专辑。经 admin_delete_media 同事务处理：专辑会连同下属曲目一起删。 */
export async function deleteMusicTree(
  db: SupabaseClient,
  id: string,
  confirmTitle: string,
): Promise<"album" | "music"> {
  const { data: target, error } = await db.from("media_items").select("id,title,type").eq("id", id).maybeSingle();
  assertOk(error);
  if (!target) throw new SaveMusicMediaError("资料已不存在，请刷新后重试。", "P0002");
  if (target.type !== "album" && target.type !== "music") {
    throw new SaveMusicMediaError("只支持删除专辑与曲目。");
  }
  if (target.title !== confirmTitle) throw new SaveMusicMediaError("标题不匹配，请输入当前条目的完整标题。", "22023");

  const { error: deleteError } = await db.rpc("admin_delete_media", {
    p_id: id,
    p_confirm_title: confirmTitle,
  });
  assertOk(deleteError);
  return target.type;
}
