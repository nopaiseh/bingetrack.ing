import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaInput, PersonRef } from "@/lib/admin/media-form";
import { findMusicDuplicateId } from "@/lib/music/dedupe";
import { resolveMusicCover } from "@/lib/music/resolve-cover";

type CreditRole = "artist" | "lyricist" | "composer";

const WRITE_ERROR = "保存失败，请检查字段或数据库配置后重试。";
const PERMISSION_ERROR = "没有写入权限，请检查站长账号配置。";

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

async function replaceCredits(db: SupabaseClient, mediaId: string, role: CreditRole, people: PersonRef[]) {
  const { error: deleteError } = await db.from("media_credits").delete().eq("media_item_id", mediaId).eq("role", role);
  assertOk(deleteError);
  if (people.length === 0) return;
  const rows = [];
  for (let index = 0; index < people.length; index += 1) {
    const personId = await resolvePerson(db, people[index]);
    rows.push({ media_item_id: mediaId, person_id: personId, role, credit_order: index });
  }
  const { error } = await db
    .from("media_credits")
    .upsert(rows, { onConflict: "media_item_id,person_id,role", ignoreDuplicates: true });
  assertOk(error);
}

async function replaceNamedLinks(
  db: SupabaseClient,
  mediaId: string,
  table: "genres",
  link: "media_genres",
  key: "genre_id",
  names: string[],
) {
  const { error: deleteError } = await db.from(link).delete().eq("media_item_id", mediaId);
  assertOk(deleteError);
  for (const name of names) {
    const { data, error } = await db.from(table).upsert({ name }, { onConflict: "name" }).select("id").single();
    assertOk(error);
    if (!data?.id) throw new SaveMusicMediaError(WRITE_ERROR);
    const { error: linkError } = await db.from(link).upsert({ media_item_id: mediaId, [key]: data.id });
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
 * 保存专辑或曲目。
 * admin_save_media 尚未接受 album／music（需迁移扩展）；此处用站长 RLS 直写既有表，
 * 权限仍经 requireOwner → is_site_owner。多语句非单事务，失败时可能留下半成品，需人工清理或后续迁入 RPC。
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
  const duplicateId = await findMusicDuplicateId(db, {
    type: payload.type,
    title: payload.title,
    artists: artistNames,
  }).catch(() => null);
  if (duplicateId && duplicateId !== payload.id) {
    throw new SaveMusicMediaError(
      payload.type === "album" ? "已存在同名同艺人的专辑。" : "已存在同名同艺人的曲目。",
      "23505",
    );
  }

  let coverUrl = payload.cover_url;
  if (!coverUrl) {
    coverUrl = await resolveMusicCover({
      title: payload.title,
      artist: artistNames[0] ?? null,
      entity: payload.type === "album" ? "album" : "song",
    }).catch(() => null);
  }

  let itemId = payload.id;
  if (!itemId) {
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
  } else {
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

  if (!itemId) throw new SaveMusicMediaError(WRITE_ERROR);

  if (payload.type === "album") {
    const { error } = await db.from("music_albums").upsert({
      media_item_id: itemId,
      label: payload.label,
    });
    assertOk(error);
    await replaceCredits(db, itemId, "artist", payload.artists);
    await replaceNamedLinks(db, itemId, "genres", "media_genres", "genre_id", payload.genres);
    await replaceCollections(db, itemId, payload.collections ?? []);
  } else {
    if (!payload.parent_id) throw new SaveMusicMediaError("请指定所属专辑和曲序。");
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
