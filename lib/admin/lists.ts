import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nameOrAliasFilter, titleOrAliasFilter } from "@/lib/admin/catalog";
import { affectedMediaIds, referenceMediaIds, revalidateMediaItems } from "@/lib/admin/revalidate-media";
import {
  type AdminListInput,
  type AdminListPage,
  type AdminMediaListType,
  type BulkCounts,
  type MediaListItem,
  type MediaSortKey,
  type PersonListItem,
  parseAdminMediaListType,
  parseAdminMediaQuery,
  parseAdminPeopleQuery,
  parseBulkIds,
  parseBulkStatus,
} from "@/lib/admin/list-params";

const LIST_READ_ERROR = "无法读取管理列表，请重试。";
const DELETE_ERROR = "删除失败，请重试。";
const STATUS_ERROR = "状态更新失败，请重试。";
const PERMISSION_ERROR = "没有写入权限，请检查站长账号配置。";
/** 与 supabase/config.toml 的 max_rows 一致。嵌入资源不保证超过这个数，所以单集按页读取。 */
const EPISODE_PAGE = 1000;
const MAX_EPISODE_PAGES = 100;

const mediaSortColumns = {
  date: "sort_date",
  title: "title",
  rating: "rating",
} as const satisfies Record<MediaSortKey, string>;

type QueryError = { code?: string } | null;

function assertWrite(error: QueryError, fallback: string) {
  if (!error) return;
  if (error.code === "42501") throw new Error(PERMISSION_ERROR);
  throw new Error(fallback);
}

function readPage<T>(result: { data: unknown; error: QueryError; count: number | null }, message: string) {
  if (result.error || typeof result.count !== "number") throw new Error(message);
  return { rows: (result.data ?? []) as T[], total: result.count };
}

function readRows<T>(result: { data: unknown; error: QueryError }, message: string) {
  if (result.error) throw new Error(message);
  return (result.data ?? []) as T[];
}

function toNumber(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function watchStatus(value: string | null | undefined): MediaListItem["status"] {
  if (value === "watched" || value === "watching" || value === "want_to_watch") return value;
  return "want_to_watch";
}

type OrderOptions = { ascending: boolean; nullsFirst?: boolean };

/** 主排序之后用标题和 ID 固定次序，避免同值记录在翻页时跳动。空值一律排在最后。 */
function orderMedia<Query extends { order: (column: string, options?: OrderOptions) => Query }>(query: Query, sort: MediaSortKey, ascending: boolean) {
  const ordered = query.order(mediaSortColumns[sort], { ascending, nullsFirst: false });
  return sort === "title" ? ordered.order("id", { ascending: true }) : ordered.order("title", { ascending: true }).order("id", { ascending: true });
}

type PersonRow = {
  id: string;
  name: string;
  alternate_name: string | null;
  media_credits: { count: number }[] | null;
};

/**
 * 分页读取人物。搜索走姓名、别名的 ILIKE（已有 GIN trigram 索引），计数为精确总数。
 * 调用方必须已经通过 requireOwner()；本函数不再重复检查身份。
 */
export async function listAdminPeople(db: SupabaseClient, input?: AdminListInput | null): Promise<AdminListPage<PersonListItem>> {
  const query = parseAdminPeopleQuery(input);
  const start = (query.page - 1) * query.pageSize;
  let request = db.from("people").select("id,name,alternate_name,media_credits(count)", { count: "exact" });
  if (query.q) request = request.or(nameOrAliasFilter(query.q));
  const page = readPage<PersonRow>(await request
    .order(query.sort, { ascending: query.direction === "asc", nullsFirst: false })
    .order("id", { ascending: true })
    .range(start, start + query.pageSize - 1), LIST_READ_ERROR);
  return {
    items: page.rows.map((row) => ({
      id: row.id,
      name: row.name,
      alternate_name: row.alternate_name,
      credit_count: row.media_credits?.[0]?.count ?? 0,
    })),
    total: page.total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

type OrderRow = {
  id: string;
  title: string;
  alternate_title: string | null;
  status: string | null;
  rating: number | string | null;
  sort_date: string | null;
};

type DetailRow = {
  id: string;
  cover_url: string | null;
  release_date: string | null;
  runtime: number | string | null;
  seasons: { episodes?: { count: number }[] | null }[] | null;
};

/**
 * 分页读取电影或电视节目。筛选、排序和精确计数都在 v_manage_media_order 上完成，
 * 再用一页 ID 补封面、片长和季集数量。排序视图的日期、状态、评分是计算列，不能另建索引。
 * 调用方必须已经通过 requireOwner()。
 */
export async function listAdminMedia(db: SupabaseClient, type: AdminMediaListType, input?: AdminListInput | null): Promise<AdminListPage<MediaListItem>> {
  const mediaType = parseAdminMediaListType(type);
  const query = parseAdminMediaQuery(input);
  const start = (query.page - 1) * query.pageSize;
  let request = db.from("v_manage_media_order").select("id,title,alternate_title,status,rating,sort_date", { count: "exact" }).eq("type", mediaType);
  if (query.q) request = request.or(titleOrAliasFilter(query.q));
  const page = readPage<OrderRow>(await orderMedia(request, query.sort, query.direction === "asc").range(start, start + query.pageSize - 1), LIST_READ_ERROR);
  const ids = page.rows.map((row) => row.id);
  const details = ids.length === 0 ? [] : readRows<DetailRow>(await db.from("media_items").select("id,cover_url,release_date,runtime,seasons:tv_seasons!tv_seasons_series_id_fkey(episodes:tv_episodes!tv_episodes_season_id_fkey(count))").in("id", ids), LIST_READ_ERROR);
  const detailById = new Map(details.map((row) => [row.id, row]));
  return {
    items: page.rows.map((row) => {
      const detail = detailById.get(row.id);
      const seasons = detail?.seasons ?? [];
      return {
        id: row.id,
        type: mediaType,
        title: row.title,
        alternate_title: row.alternate_title,
        cover_url: detail?.cover_url ?? null,
        release_date: detail?.release_date ?? null,
        runtime: toNumber(detail?.runtime),
        sort_date: row.sort_date,
        status: watchStatus(row.status),
        rating: toNumber(row.rating),
        season_count: seasons.length,
        episode_count: seasons.reduce((sum, season) => sum + (season.episodes?.[0]?.count ?? 0), 0),
      };
    }),
    total: page.total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

function deletedIds(rows: { id: string }[]) {
  return new Set(rows.map((row) => row.id.toLowerCase()));
}

/** 只保留这次请求里的 ID，并按小写去重，避免返回行重复时把成功数加过请求数。 */
function rowsIn<Row extends { id: string }>(rows: Row[], allowed: string[]) {
  const allow = new Set(allowed);
  const seen = new Set<string>();
  const unique: Row[] = [];
  for (const row of rows) {
    const id = row.id.toLowerCase();
    if (!allow.has(id) || seen.has(id)) continue;
    seen.add(id);
    unique.push({ ...row, id });
  }
  return unique;
}

/**
 * 删除人物。演职关联和「不是同一人」记录随外键级联删除，影视条目保留。
 * music_albums.artist_id 没有级联：仍被专辑引用的人物计为失败，不改表结构。音乐表本身不写入。
 */
export async function bulkDeletePeople(db: SupabaseClient, ids: unknown): Promise<BulkCounts> {
  const targets = parseBulkIds(ids);
  const blockedRows = readRows<{ artist_id: string | null }>(await db.from("music_albums").select("artist_id").in("artist_id", targets), DELETE_ERROR);
  const blocked = new Set(blockedRows.flatMap((row) => row.artist_id ? [row.artist_id.toLowerCase()] : []));
  const deletable = targets.filter((id) => !blocked.has(id));
  if (deletable.length === 0) return { succeeded: 0, failed: targets.length };
  // 级联会先删掉演职关联，受影响的详情页必须在删除前查出。
  const affected = await referenceMediaIds(db, "people", deletable);
  const { data, error } = await db.from("people").delete().in("id", deletable).select("id");
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
 * 删除电视节目。只删 media_items 里的节目行会级联掉季、集关系，却留下季和单集的媒体行；
 * 因此每个节目调用现有的 admin_delete_media，在一个事务里删掉整棵树。不新增数据库函数。
 */
export async function bulkDeleteTvShows(db: SupabaseClient, ids: unknown): Promise<BulkCounts> {
  const targets = parseBulkIds(ids);
  const shows = rowsIn(readRows<{ id: string; title: string }>(await db.from("media_items").select("id,title").in("id", targets).eq("type", "tv_show"), DELETE_ERROR), targets);
  if (shows.length === 0) return { succeeded: 0, failed: targets.length };
  const affected = await affectedMediaIds(db, shows.map((show) => show.id));
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
    const rows = readRows<EpisodeRow>(await db.from("tv_episodes")
      .select("id, tv_seasons!tv_episodes_season_id_fkey!inner(series_id)")
      .in("tv_seasons.series_id", showIds)
      .order("id", { ascending: true })
      .range(start, start + EPISODE_PAGE - 1), STATUS_ERROR);
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
 */
export async function bulkSetMovieStatus(db: SupabaseClient, ids: unknown, status: unknown): Promise<BulkCounts> {
  const targets = parseBulkIds(ids);
  const nextStatus = parseBulkStatus(status);
  const movieIds = rowsIn(readRows<{ id: string }>(await db.from("media_items").select("id").in("id", targets).eq("type", "movie"), STATUS_ERROR), targets).map((row) => row.id);
  if (movieIds.length === 0) return { succeeded: 0, failed: targets.length };
  const { error } = await db.from("tracking").upsert(movieIds.map((media_item_id) => ({ media_item_id, status: nextStatus })), { onConflict: "media_item_id", defaultToNull: false }).select("media_item_id");
  assertWrite(error, STATUS_ERROR);
  revalidateMediaItems(await affectedMediaIds(db, movieIds));
  return { succeeded: movieIds.length, failed: targets.length - movieIds.length };
}

/**
 * 更新电视节目的观看状态。节目自己没有 tracking 行，状态由全部单集决定，
 * 所以一次写入这些单集的 tracking.status，不改评分。没有单集时无法标成已看，该节目计为失败；
 * 标成想看则已经是汇总结果，计为成功。人物没有观看状态，这里不接受人物。
 */
export async function bulkSetTvShowStatus(db: SupabaseClient, ids: unknown, status: unknown): Promise<BulkCounts> {
  const targets = parseBulkIds(ids);
  const nextStatus = parseBulkStatus(status);
  const showIds = rowsIn(readRows<{ id: string }>(await db.from("media_items").select("id").in("id", targets).eq("type", "tv_show"), STATUS_ERROR), targets).map((row) => row.id);
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
  const { error } = await db.from("tracking").upsert(uniqueEpisodes.map((media_item_id) => ({ media_item_id, status: nextStatus })), { onConflict: "media_item_id", defaultToNull: false }).select("media_item_id");
  assertWrite(error, STATUS_ERROR);
  revalidateMediaItems(await affectedMediaIds(db, [...writable, ...uniqueEpisodes]));
  return { succeeded: succeeded + writable.length, failed };
}
