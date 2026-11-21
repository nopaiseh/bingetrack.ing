import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { affectedMediaIds, referenceMediaIds, revalidateMediaItems } from "@/lib/admin/revalidate-media";
import { type BulkCounts, parseBulkIds, parseBulkStatus, parseBookBulkStatus } from "@/lib/admin/list-params";
import {
  DELETE_ERROR,
  EPISODE_PAGE,
  MAX_EPISODE_PAGES,
  PERMISSION_ERROR,
  STATUS_ERROR,
  assertWrite,
  deletedIds,
  readRows,
  rowsIn,
} from "./shared";

/**
 * 删除人物。演职关联和「不是同一人」记录随外键级联删除，影视条目保留。
 * media_credits 随 people 级联删除，不额外拦截。
 */
export async function bulkDeletePeople(db: SupabaseClient, ids: unknown): Promise<BulkCounts> {
  const targets = parseBulkIds(ids);
  if (targets.length === 0) return { succeeded: 0, failed: 0 };
  // 级联会先删掉演职关联，受影响的详情页必须在删除前查出。
  const affected = await referenceMediaIds(db, "people", targets);
  const { data, error } = await db.from("people").delete().in("id", targets).select("id");
  if (error?.code === "23503") return { succeeded: 0, failed: targets.length };
  assertWrite(error, DELETE_ERROR);
  const succeeded = deletedIds((data ?? []) as { id: string }[]).size;
  if (succeeded > 0) revalidateMediaItems(affected);
  return { succeeded, failed: targets.length - succeeded };
}

/**
 * 删除电影。一次语句按类型过滤，不存在或不是电影的 ID 计为失败。
 * 观看记录、演职员、类型、地区、语言和系列成员随外键级联删除，不留下下属媒体行。
 */
export async function bulkDeleteMovies(db: SupabaseClient, ids: unknown): Promise<BulkCounts> {
  const targets = parseBulkIds(ids);
  const affected = await affectedMediaIds(db, targets);
  const { data, error } = await db.from("media_items").delete().in("id", targets).eq("type", "movie").select("id");
  if (error?.code === "23503") return { succeeded: 0, failed: targets.length };
  assertWrite(error, DELETE_ERROR);
  const succeeded = deletedIds((data ?? []) as { id: string }[]).size;
  if (succeeded > 0) revalidateMediaItems(affected);
  return { succeeded, failed: targets.length - succeeded };
}

/**
 * 删除图书。books 行、阅读记录与作者关联随 media_items 外键级联删除。
 */
export async function bulkDeleteBooks(db: SupabaseClient, ids: unknown): Promise<BulkCounts> {
  const targets = parseBulkIds(ids);
  const affected = await affectedMediaIds(db, targets);
  const { data, error } = await db.from("media_items").delete().in("id", targets).eq("type", "book").select("id");
  if (error?.code === "23503") return { succeeded: 0, failed: targets.length };
  assertWrite(error, DELETE_ERROR);
  const succeeded = deletedIds((data ?? []) as { id: string }[]).size;
  if (succeeded > 0) revalidateMediaItems(affected);
  return { succeeded, failed: targets.length - succeeded };
}

/**
 * 批量删除专辑及其曲目。每个专辑各自调用 admin_delete_media，同事务删掉下属曲目与专辑本身。
 */
export async function bulkDeleteAlbums(db: SupabaseClient, ids: unknown): Promise<BulkCounts> {
  const targets = parseBulkIds(ids);
  const albums = rowsIn(
    readRows<{ id: string; title: string }>(
      await db.from("media_items").select("id,title").in("id", targets).eq("type", "album"),
      DELETE_ERROR,
    ),
    targets,
  );
  if (albums.length === 0) return { succeeded: 0, failed: targets.length };
  const affected = await affectedMediaIds(
    db,
    albums.map((album) => album.id),
  );
  let succeeded = 0;
  for (const album of albums) {
    const { error } = await db.rpc("admin_delete_media", { p_id: album.id, p_confirm_title: album.title });
    // 权限错误说明整次请求都不可写；单个专辑被并发删改则只记失败，继续处理其余专辑。
    if (error?.code === "42501") {
      if (succeeded > 0) revalidateMediaItems(affected);
      throw new Error(PERMISSION_ERROR);
    }
    if (!error) succeeded += 1;
  }
  if (succeeded > 0) revalidateMediaItems(affected);
  return { succeeded, failed: targets.length - succeeded };
}

/**
 * 删除电视节目。只删 media_items 里的节目行会级联掉季、集关系，却留下季和单集的媒体行；
 * 因此每个节目调用现有的 admin_delete_media，在一个事务里删掉整棵树。不新增数据库函数。
 */
export async function bulkDeleteTvShows(db: SupabaseClient, ids: unknown): Promise<BulkCounts> {
  const targets = parseBulkIds(ids);
  const shows = rowsIn(
    readRows<{ id: string; title: string }>(
      await db.from("media_items").select("id,title").in("id", targets).eq("type", "tv_show"),
      DELETE_ERROR,
    ),
    targets,
  );
  if (shows.length === 0) return { succeeded: 0, failed: targets.length };
  const affected = await affectedMediaIds(
    db,
    shows.map((show) => show.id),
  );
  let succeeded = 0;
  for (const show of shows) {
    const { error } = await db.rpc("admin_delete_media", { p_id: show.id, p_confirm_title: show.title });
    // 权限错误说明整次请求都不可写；单个节目被并发删改则只记失败，继续处理其余节目。
    if (error?.code === "42501") {
      if (succeeded > 0) revalidateMediaItems(affected);
      throw new Error(PERMISSION_ERROR);
    }
    if (!error) succeeded += 1;
  }
  if (succeeded > 0) revalidateMediaItems(affected);
  return { succeeded, failed: targets.length - succeeded };
}

type EpisodeRow = {
  id: string;
  tv_seasons: { series_id: string } | { series_id: string }[] | null;
};

/** 按节目归集单集。PostgREST 一次最多返回 max_rows 行，所以用稳定的 ID 顺序翻页，避免长节目被截断。 */
async function episodeIdsByShow(db: SupabaseClient, showIds: string[]) {
  const grouped = new Map<string, Set<string>>();
  for (let page = 0; page < MAX_EPISODE_PAGES; page += 1) {
    const start = page * EPISODE_PAGE;
    const rows = readRows<EpisodeRow>(
      await db
        .from("tv_episodes")
        .select("id, tv_seasons!tv_episodes_season_id_fkey!inner(series_id)")
        .in("tv_seasons.series_id", showIds)
        .order("id", { ascending: true })
        .range(start, start + EPISODE_PAGE - 1),
      STATUS_ERROR,
    );
    for (const row of rows) {
      const season = Array.isArray(row.tv_seasons) ? row.tv_seasons[0] : row.tv_seasons;
      if (!season?.series_id) continue;
      const seriesId = season.series_id.toLowerCase();
      const episodes = grouped.get(seriesId) ?? new Set<string>();
      episodes.add(row.id);
      grouped.set(seriesId, episodes);
    }
    if (rows.length < EPISODE_PAGE) return grouped;
  }
  throw new Error(STATUS_ERROR);
}

/**
 * 更新电影的观看状态。只写 tracking.status，保留已有评分（defaultToNull: false）。
 * 没有记录的电影会插入一行，评分留空。这可能让「观看记录矛盾」报告出现新行，批量操作不改评分。
 * 写入成功后 revalidateMediaItems 会 revalidateTag("media:lists")，首页继续看和其他聚合缓存马上失效。
 */
export async function bulkSetMovieStatus(db: SupabaseClient, ids: unknown, status: unknown): Promise<BulkCounts> {
  const targets = parseBulkIds(ids);
  const nextStatus = parseBulkStatus(status);
  const movieIds = rowsIn(
    readRows<{ id: string }>(
      await db.from("media_items").select("id").in("id", targets).eq("type", "movie"),
      STATUS_ERROR,
    ),
    targets,
  ).map((row) => row.id);
  if (movieIds.length === 0) return { succeeded: 0, failed: targets.length };
  const { error } = await db
    .from("tracking")
    .upsert(
      movieIds.map((media_item_id) => ({ media_item_id, status: nextStatus })),
      { onConflict: "media_item_id", defaultToNull: false },
    )
    .select("media_item_id");
  assertWrite(error, STATUS_ERROR);
  revalidateMediaItems(await affectedMediaIds(db, movieIds));
  return { succeeded: movieIds.length, failed: targets.length - movieIds.length };
}

/**
 * 更新图书阅读状态。接受 want_to_watch／in_progress／watched；只写 status，保留评分。
 * in_progress 仅图书合法（数据库触发器也会拒绝非图书）。
 */
export async function bulkSetBookStatus(db: SupabaseClient, ids: unknown, status: unknown): Promise<BulkCounts> {
  const targets = parseBulkIds(ids);
  const nextStatus = parseBookBulkStatus(status);
  const bookIds = rowsIn(
    readRows<{ id: string }>(
      await db.from("media_items").select("id").in("id", targets).eq("type", "book"),
      STATUS_ERROR,
    ),
    targets,
  ).map((row) => row.id);
  if (bookIds.length === 0) return { succeeded: 0, failed: targets.length };
  const { error } = await db
    .from("tracking")
    .upsert(
      bookIds.map((media_item_id) => ({ media_item_id, status: nextStatus })),
      { onConflict: "media_item_id", defaultToNull: false },
    )
    .select("media_item_id");
  assertWrite(error, STATUS_ERROR);
  revalidateMediaItems(await affectedMediaIds(db, bookIds));
  return { succeeded: bookIds.length, failed: targets.length - bookIds.length };
}

/**
 * 更新电视节目的观看状态。节目自己没有 tracking 行，状态由全部单集决定，
 * 所以一次写入这些单集的 tracking.status，不改评分。没有单集时无法标成已看，该节目计为失败；
 * 标成想看则已经是汇总结果，计为成功。人物没有观看状态，这里不接受人物。
 * 真正写入单集后同样走 revalidateMediaItems，失效 media:lists，首页继续看不会停在旧进度。
 */
export async function bulkSetTvShowStatus(db: SupabaseClient, ids: unknown, status: unknown): Promise<BulkCounts> {
  const targets = parseBulkIds(ids);
  const nextStatus = parseBulkStatus(status);
  const showIds = rowsIn(
    readRows<{ id: string }>(
      await db.from("media_items").select("id").in("id", targets).eq("type", "tv_show"),
      STATUS_ERROR,
    ),
    targets,
  ).map((row) => row.id);
  if (showIds.length === 0) return { succeeded: 0, failed: targets.length };
  const episodes = await episodeIdsByShow(db, showIds);
  const writable: string[] = [];
  const episodeIds: string[] = [];
  let succeeded = 0;
  let failed = targets.length - showIds.length;
  for (const showId of showIds) {
    const idsForShow = [...(episodes.get(showId) ?? [])];
    if (idsForShow.length === 0) {
      if (nextStatus === "want_to_watch") succeeded += 1;
      else failed += 1;
      continue;
    }
    writable.push(showId);
    episodeIds.push(...idsForShow);
  }
  const uniqueEpisodes = [...new Set(episodeIds)];
  if (uniqueEpisodes.length === 0) return { succeeded, failed };
  const { error } = await db
    .from("tracking")
    .upsert(
      uniqueEpisodes.map((media_item_id) => ({ media_item_id, status: nextStatus })),
      { onConflict: "media_item_id", defaultToNull: false },
    )
    .select("media_item_id");
  assertWrite(error, STATUS_ERROR);
  revalidateMediaItems(await affectedMediaIds(db, [...writable, ...uniqueEpisodes]));
  return { succeeded: succeeded + writable.length, failed };
}
