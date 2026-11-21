/**
 * 曲目展示封面：一律用所属专辑的 cover_url，忽略曲目自身存储的 cover_url。
 * 专辑无封面时返回 null／空串，走现有色块首字占位，不回退到曲目封面、不额外抓取。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** 曲目展示用封面：仅取专辑封面；无图则为 null。 */
export function trackDisplayCoverUrl(albumCoverUrl: string | null | undefined): string | null {
  const trimmed = albumCoverUrl?.trim();
  return trimmed ? trimmed : null;
}

/**
 * 按类型决定展示封面。
 * type === "music" 时只用 albumCoverUrl；其它类型用自身 cover_url。
 */
export function displayCoverUrl(
  type: string | null | undefined,
  ownCoverUrl: string | null | undefined,
  albumCoverUrl: string | null | undefined,
): string | null {
  if (type === "music") return trackDisplayCoverUrl(albumCoverUrl);
  const own = ownCoverUrl?.trim();
  return own ? own : null;
}

type DbClient = Pick<SupabaseClient, "from">;

/**
 * 批量：曲目 id → 所属专辑 cover_url。
 * 两步查询（music.album_id → media_items.cover_url），避免 N+1。
 * 无 music 行或专辑无封面时映射为 null。
 */
export async function fetchAlbumCoversByTrackIds(
  db: DbClient,
  trackIds: readonly string[],
): Promise<Map<string, string | null>> {
  const unique = [...new Set(trackIds.filter((id) => typeof id === "string" && id.length > 0))];
  const result = new Map<string, string | null>();
  if (unique.length === 0) return result;

  const { data: links, error: linkError } = await db
    .from("music")
    .select("media_item_id, album_id")
    .in("media_item_id", unique);
  if (linkError) throw new Error("无法读取曲目所属专辑。");

  const albumIds = [
    ...new Set((links ?? []).map((row) => row.album_id as string | null).filter((id): id is string => Boolean(id))),
  ];
  const coverByAlbum = new Map<string, string | null>();
  if (albumIds.length > 0) {
    const { data: albums, error: albumError } = await db
      .from("media_items")
      .select("id, cover_url")
      .in("id", albumIds)
      .eq("type", "album");
    if (albumError) throw new Error("无法读取专辑封面。");
    for (const row of albums ?? []) {
      coverByAlbum.set(row.id as string, trackDisplayCoverUrl(row.cover_url as string | null));
    }
  }

  for (const row of links ?? []) {
    const trackId = row.media_item_id as string;
    const albumId = row.album_id as string | null;
    result.set(trackId, albumId ? (coverByAlbum.get(albumId) ?? null) : null);
  }
  return result;
}

type CoverBearing = {
  id: string;
  cover_url?: string | null;
  type?: string | null;
  dbType?: string | null;
};

/** 默认：数据库类型或公开 type 为 music 的条目视为曲目。 */
export function isMusicTrackItem(item: CoverBearing): boolean {
  return item.dbType === "music" || item.type === "music";
}

/**
 * 就地为曲目条目替换 cover_url 为所属专辑封面；非曲目不动。
 * 专辑无封面时写 null（调用方若需空串可再规范化）。
 */
export async function withAlbumCoversForTracks<T extends CoverBearing>(
  db: DbClient,
  items: readonly T[],
  isTrack: (item: T) => boolean = isMusicTrackItem as (item: T) => boolean,
): Promise<T[]> {
  const trackIds = items.filter(isTrack).map((item) => item.id);
  if (trackIds.length === 0) return [...items];
  const covers = await fetchAlbumCoversByTrackIds(db, trackIds);
  return items.map((item) => {
    if (!isTrack(item)) return item;
    return { ...item, cover_url: trackDisplayCoverUrl(covers.get(item.id)) };
  });
}
