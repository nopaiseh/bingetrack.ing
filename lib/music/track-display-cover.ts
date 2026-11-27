/**
 * 曲目展示封面：有自身 cover_url 时用自身；否则回退所属专辑封面。
 * 专辑亦无封面时返回 null／空串，走现有色块首字占位，不额外抓取。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** 规范化封面 URL：空白视为无封面。 */
export function trackDisplayCoverUrl(coverUrl: string | null | undefined): string | null {
  const trimmed = coverUrl?.trim();
  return trimmed ? trimmed : null;
}

/**
 * 按类型决定展示封面。
 * type === "music"：自身封面优先，否则用 albumCoverUrl；其它类型只用自身 cover_url。
 */
export function displayCoverUrl(
  type: string | null | undefined,
  ownCoverUrl: string | null | undefined,
  albumCoverUrl: string | null | undefined,
): string | null {
  if (type === "music") {
    return trackDisplayCoverUrl(ownCoverUrl) ?? trackDisplayCoverUrl(albumCoverUrl);
  }
  return trackDisplayCoverUrl(ownCoverUrl);
}

type DbClient = Pick<SupabaseClient, "from">;

/**
 * 批量：曲目 id → 所属专辑 cover_url。
 * 两步查询（album_tracks → media_items.cover_url），避免 N+1。
 * 一首歌多专辑时取 release_date 最早且有封面的专辑；无关联或无封面时为 null。
 */
export async function fetchAlbumCoversByTrackIds(
  db: DbClient,
  trackIds: readonly string[],
): Promise<Map<string, string | null>> {
  const unique = [...new Set(trackIds.filter((id) => typeof id === "string" && id.length > 0))];
  const result = new Map<string, string | null>();
  if (unique.length === 0) return result;

  const { data: links, error: linkError } = await db
    .from("album_tracks")
    .select("song_id, album_id")
    .in("song_id", unique);
  if (linkError) throw new Error("无法读取曲目所属专辑。");

  const albumIds = [
    ...new Set((links ?? []).map((row) => row.album_id as string | null).filter((id): id is string => Boolean(id))),
  ];
  const coverByAlbum = new Map<string, string | null>();
  if (albumIds.length === 0) {
    for (const trackId of unique) result.set(trackId, null);
    return result;
  }

  const { data: albums, error: albumError } = await db
    .from("media_items")
    .select("id, cover_url, release_date")
    .in("id", albumIds)
    .eq("type", "album");
  if (albumError) throw new Error("无法读取专辑封面。");

  // 按发行日排序后写入，使「先遇到的有封面专辑」偏早
  const sorted = [...(albums ?? [])].sort((a, b) => {
    const da = (a.release_date as string | null) ?? "9999";
    const dbDate = (b.release_date as string | null) ?? "9999";
    return da.localeCompare(dbDate);
  });
  for (const row of sorted) {
    coverByAlbum.set(row.id as string, trackDisplayCoverUrl(row.cover_url as string | null));
  }

  for (const trackId of unique) {
    const albumIdsForTrack = (links ?? [])
      .filter((row) => row.song_id === trackId)
      .map((row) => row.album_id as string);
    let cover: string | null = null;
    for (const albumId of albumIdsForTrack) {
      const candidate = coverByAlbum.get(albumId) ?? null;
      if (candidate) {
        cover = candidate;
        break;
      }
    }
    result.set(trackId, cover);
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
 * 就地为曲目条目补封面：自身无封面时写入所属专辑封面；已有自身封面则保留。
 * 非曲目不动。
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
    const own = trackDisplayCoverUrl(item.cover_url);
    if (own) return { ...item, cover_url: own };
    return { ...item, cover_url: trackDisplayCoverUrl(covers.get(item.id)) };
  });
}
