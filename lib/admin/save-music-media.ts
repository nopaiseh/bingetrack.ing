import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaInput, PersonRef } from "@/lib/admin/media-form";
import { findMusicDuplicateId, isDuplicateMusicEntry } from "@/lib/music/dedupe";
import { resolveMusicCover } from "@/lib/music/resolve-cover";

type CreditRole = "artist" | "lyricist" | "composer";

const WRITE_ERROR = "保存失败，请检查字段或数据库配置后重试。";
const PERMISSION_ERROR = "没有写入权限，请检查站长账号配置。";
const TRACK_NUMBER_TAKEN = "曲序已存在。";

function writeError(code?: string) {
  if (code === "23505") return "同一专辑中已存在这个曲序，请更换曲序。";
  if (code === "23503" || code === "P0002") return "资料或所属专辑已不存在，请刷新后重试。";
  if (code === "42501") return PERMISSION_ERROR;
  return WRITE_ERROR;
}

function assertOk(error: { code?: string; message?: string } | null) {
  if (!error) return;
  throw new SaveMusicMediaError(writeError(error.code), error.code);
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

/** 按 ID 校验人物，或按姓名匹配／新建（无别名；与 admin_save_media 同口径）。 */
async function resolvePerson(db: SupabaseClient, person: PersonRef): Promise<string> {
  if (person.id) {
    const { data, error } = await db.from("people").select("id").eq("id", person.id).maybeSingle();
    assertOk(error);
    if (!data) throw new SaveMusicMediaError("人物不存在，请刷新后重试。", "P0002");
    return data.id;
  }
  const { data: existing, error: findError } = await db
    .from("people")
    .select("id")
    .eq("name", person.name)
    .is("alternate_name", null)
    .maybeSingle();
  assertOk(findError);
  if (existing?.id) return existing.id;
  const { data, error } = await db.from("people").insert({ name: person.name }).select("id").single();
  assertOk(error);
  if (!data?.id) throw new SaveMusicMediaError(WRITE_ERROR);
  return data.id;
}

/**
 * 先解析全部人物 ID，全部成功后再删旧写新，避免删完一半却因人物解析失败留下空演职员。
 */
async function replaceCredits(db: SupabaseClient, mediaId: string, role: CreditRole, people: PersonRef[]) {
  const personIds: string[] = [];
  for (const person of people) {
    personIds.push(await resolvePerson(db, person));
  }
  const { error: deleteError } = await db.from("media_credits").delete().eq("media_item_id", mediaId).eq("role", role);
  assertOk(deleteError);
  if (personIds.length === 0) return;
  const rows = personIds.map((personId, index) => ({
    media_item_id: mediaId,
    person_id: personId,
    role,
    credit_order: index,
  }));
  const { error } = await db
    .from("media_credits")
    .upsert(rows, { onConflict: "media_item_id,person_id,role", ignoreDuplicates: true });
  assertOk(error);
}

/** 先 upsert／解析全部类型 ID，再删旧关联并写入，避免删后半途失败。 */
async function replaceNamedLinks(
  db: SupabaseClient,
  mediaId: string,
  table: "genres",
  link: "media_genres",
  key: "genre_id",
  names: string[],
) {
  const ids: string[] = [];
  for (const name of names) {
    const { data, error } = await db.from(table).upsert({ name }, { onConflict: "name" }).select("id").single();
    assertOk(error);
    if (!data?.id) throw new SaveMusicMediaError(WRITE_ERROR);
    ids.push(data.id);
  }
  const { error: deleteError } = await db.from(link).delete().eq("media_item_id", mediaId);
  assertOk(deleteError);
  for (const id of ids) {
    const { error: linkError } = await db.from(link).upsert({ media_item_id: mediaId, [key]: id });
    assertOk(linkError);
  }
}

async function replaceCollections(db: SupabaseClient, mediaId: string, names: string[]) {
  const collectionIds: string[] = [];
  for (const name of names) {
    const { data, error } = await db
      .from("media_series")
      .upsert({ name }, { onConflict: "name" })
      .select("id")
      .single();
    assertOk(error);
    if (!data?.id) throw new SaveMusicMediaError(WRITE_ERROR);
    collectionIds.push(data.id);
    const { data: maxRow } = await db
      .from("media_item_series")
      .select("position")
      .eq("series_id", data.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = (maxRow?.position ?? 0) + 1;
    const { error: linkError } = await db
      .from("media_item_series")
      .upsert(
        { media_item_id: mediaId, series_id: data.id, position },
        { onConflict: "media_item_id,series_id", ignoreDuplicates: true },
      );
    assertOk(linkError);
  }
  if (collectionIds.length === 0) {
    const { error } = await db.from("media_item_series").delete().eq("media_item_id", mediaId);
    assertOk(error);
    return;
  }
  const { error } = await db
    .from("media_item_series")
    .delete()
    .eq("media_item_id", mediaId)
    .not("series_id", "in", `(${collectionIds.join(",")})`);
  assertOk(error);
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

/** 表上无 (album_id, track_number) 唯一约束，保存前主动拦截占用。 */
async function assertTrackNumberAvailable(
  db: SupabaseClient,
  albumId: string,
  trackNumber: number,
  excludeId: string | null,
) {
  let query = db.from("music").select("media_item_id").eq("album_id", albumId).eq("track_number", trackNumber).limit(1);
  if (excludeId) query = query.neq("media_item_id", excludeId);
  const { data, error } = await query;
  assertOk(error);
  if ((data ?? []).length > 0) throw new SaveMusicMediaError(TRACK_NUMBER_TAKEN, "23505");
}

async function writeAlbumSide(db: SupabaseClient, itemId: string, payload: MediaInput) {
  const { error } = await db.from("music_albums").upsert({
    media_item_id: itemId,
    label: payload.label,
  });
  assertOk(error);
  await replaceCredits(db, itemId, "artist", payload.artists);
  await replaceNamedLinks(db, itemId, "genres", "media_genres", "genre_id", payload.genres);
  await replaceCollections(db, itemId, payload.collections ?? []);
}

async function writeTrackSide(db: SupabaseClient, itemId: string, payload: MediaInput) {
  if (!payload.parent_id || payload.number == null) {
    throw new SaveMusicMediaError("请指定所属专辑和曲序。");
  }
  await assertTrackNumberAvailable(db, payload.parent_id, payload.number, payload.id);
  const { error } = await db.from("music").upsert({
    media_item_id: itemId,
    album_id: payload.parent_id,
    track_number: payload.number,
  });
  assertOk(error);
  await replaceCredits(db, itemId, "artist", payload.artists);
  await replaceCredits(db, itemId, "lyricist", payload.lyricists);
  await replaceCredits(db, itemId, "composer", payload.composers);
  const { error: trackingError } = await db.from("tracking").upsert(
    {
      media_item_id: itemId,
      status: payload.status === "watched" ? "watched" : "want_to_watch",
      rating: payload.rating,
    },
    { onConflict: "media_item_id" },
  );
  assertOk(trackingError);
}

/**
 * 保存专辑或曲目。
 * admin_save_media 尚未接受 album／music（需迁移扩展）；此处用站长 RLS 直写既有表，
 * 权限仍经 requireOwner → is_site_owner。新建若后续步骤失败会删除刚插入的 media_items（子表级联）。
 */
export async function saveMusicMedia(db: SupabaseClient, payload: MediaInput): Promise<string> {
  if (payload.type !== "album" && payload.type !== "music") {
    throw new SaveMusicMediaError("只支持专辑与曲目。");
  }

  if (payload.type === "music") {
    const { data: album, error } = await db
      .from("media_items")
      .select("id")
      .eq("id", payload.parent_id)
      .eq("type", "album")
      .maybeSingle();
    assertOk(error);
    if (!album) throw new SaveMusicMediaError("所属专辑不存在。", "P0002");
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
  } else if (payload.parent_id) {
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

  let created = false;
  let itemId: string;
  if (!payload.id) {
    const { data, error } = await db
      .from("media_items")
      .insert({
        type: payload.type,
        title: payload.title,
        alternate_title: payload.alternate_title,
        summary: payload.summary,
        cover_url: coverUrl,
        release_date: payload.release_date,
        runtime: payload.runtime,
      })
      .select("id")
      .single();
    assertOk(error);
    if (!data?.id) throw new SaveMusicMediaError(WRITE_ERROR);
    itemId = data.id;
    created = true;
  } else {
    itemId = payload.id;
    const { data: existing, error: readError } = await db
      .from("media_items")
      .select("type")
      .eq("id", itemId)
      .maybeSingle();
    assertOk(readError);
    if (!existing) throw new SaveMusicMediaError("资料已不存在，请刷新后重试。", "P0002");
    if (existing.type !== payload.type) throw new SaveMusicMediaError("不能更改媒体类型。", "22023");
    const { error } = await db
      .from("media_items")
      .update({
        title: payload.title,
        alternate_title: payload.alternate_title,
        summary: payload.summary,
        cover_url: coverUrl,
        release_date: payload.release_date,
        runtime: payload.runtime,
      })
      .eq("id", itemId);
    assertOk(error);
  }

  try {
    if (payload.type === "album") await writeAlbumSide(db, itemId, payload);
    else await writeTrackSide(db, itemId, payload);
  } catch (error) {
    if (created) {
      await db.from("media_items").delete().eq("id", itemId);
    }
    throw error;
  }

  return itemId;
}

/** 删除曲目或其所属专辑（先删曲目 media_items，再删专辑，避开 music.album_id 无级联）。 */
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

  if (target.type === "music") {
    const { error: deleteError } = await db.from("media_items").delete().eq("id", id);
    assertOk(deleteError);
    return "music";
  }

  const { data: tracks, error: trackError } = await db.from("music").select("media_item_id").eq("album_id", id);
  assertOk(trackError);
  const trackIds = (tracks ?? []).map((row) => row.media_item_id).filter(Boolean);
  if (trackIds.length > 0) {
    const { error: deleteTracks } = await db.from("media_items").delete().in("id", trackIds);
    assertOk(deleteTracks);
  }
  const { error: deleteAlbum } = await db.from("media_items").delete().eq("id", id);
  assertOk(deleteAlbum);
  return "album";
}
