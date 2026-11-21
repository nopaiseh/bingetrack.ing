import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nameOrAliasFilter, titleOrAliasFilter } from "@/lib/admin/catalog";
import { resolveAlbumTrackCount } from "@/lib/album-display";
import {
  type AdminChildListInput,
  type AdminChildListType,
  type AdminListInput,
  type AdminListPage,
  type AdminMediaListType,
  type ChildEpisodeContext,
  type ChildListItem,
  type ChildSeasonContext,
  type ChildSortKey,
  type MediaListItem,
  type MediaSortKey,
  type ParsedAdminChildQuery,
  type PersonListItem,
  parseAdminChildListType,
  parseAdminChildQuery,
  parseAdminMediaListType,
  parseAdminMediaQuery,
  parseAdminPeopleQuery,
} from "@/lib/admin/list-params";
import {
  CHILD_LIST_READ_ERROR,
  LIST_READ_ERROR,
  childWatchStatus,
  mediaListStatus,
  readPage,
  readRows,
  toNumber,
} from "./shared";
import type { AdminChildListResult, OrderOptions } from "./types";

const mediaSortColumns = {
  date: "sort_date",
  title: "title",
  rating: "rating",
} as const satisfies Record<MediaSortKey, string>;

/** 主排序之后用标题和 ID 固定次序，避免同值记录在翻页时跳动。空值一律排在最后。 */
function orderMedia<Query extends { order: (column: string, options?: OrderOptions) => Query }>(
  query: Query,
  sort: MediaSortKey,
  ascending: boolean,
) {
  const ordered = query.order(mediaSortColumns[sort], { ascending, nullsFirst: false });
  return sort === "title"
    ? ordered.order("id", { ascending: true })
    : ordered.order("title", { ascending: true }).order("id", { ascending: true });
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
export async function listAdminPeople(
  db: SupabaseClient,
  input?: AdminListInput | null,
): Promise<AdminListPage<PersonListItem>> {
  const query = parseAdminPeopleQuery(input);
  const start = (query.page - 1) * query.pageSize;
  let request = db.from("people").select("id,name,alternate_name,media_credits(count)", { count: "exact" });
  if (query.q) request = request.or(nameOrAliasFilter(query.q));
  const page = readPage<PersonRow>(
    await request
      .order(query.sort, { ascending: query.direction === "asc", nullsFirst: false })
      .order("id", { ascending: true })
      .range(start, start + query.pageSize - 1),
    LIST_READ_ERROR,
  );
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
export async function listAdminMedia(
  db: SupabaseClient,
  type: AdminMediaListType,
  input?: AdminListInput | null,
): Promise<AdminListPage<MediaListItem>> {
  const mediaType = parseAdminMediaListType(type);
  const query = parseAdminMediaQuery(input);
  const start = (query.page - 1) * query.pageSize;
  let request = db
    .from("v_manage_media_order")
    .select("id,title,alternate_title,status,rating,sort_date", { count: "exact" })
    .eq("type", mediaType);
  if (query.q) request = request.or(titleOrAliasFilter(query.q));
  const page = readPage<OrderRow>(
    await orderMedia(request, query.sort, query.direction === "asc").range(start, start + query.pageSize - 1),
    LIST_READ_ERROR,
  );
  const ids = page.rows.map((row) => row.id);
  const details =
    ids.length === 0
      ? []
      : readRows<DetailRow>(
          await db
            .from("media_items")
            .select(
              "id,cover_url,release_date,runtime,seasons:tv_seasons!tv_seasons_series_id_fkey(episodes:tv_episodes!tv_episodes_season_id_fkey(count))",
            )
            .in("id", ids),
          LIST_READ_ERROR,
        );
  const detailById = new Map(details.map((row) => [row.id, row]));
  const trackCountByAlbum = new Map<string, number>();
  const storedTrackCountByAlbum = new Map<string, number | null>();
  if (mediaType === "album" && ids.length > 0) {
    const [trackResult, albumMetaResult] = await Promise.all([
      db.from("music").select("album_id").in("album_id", ids),
      db.from("music_albums").select("media_item_id,track_count").in("media_item_id", ids),
    ]);
    const trackRows = readRows<{ album_id: string }>(trackResult, LIST_READ_ERROR);
    const albumMetaRows = readRows<{ media_item_id: string; track_count: number | null }>(
      albumMetaResult,
      LIST_READ_ERROR,
    );
    for (const row of trackRows) {
      if (!row.album_id) continue;
      trackCountByAlbum.set(row.album_id, (trackCountByAlbum.get(row.album_id) ?? 0) + 1);
    }
    for (const row of albumMetaRows) {
      storedTrackCountByAlbum.set(row.media_item_id, row.track_count == null ? null : Number(row.track_count));
    }
  }
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
        status: mediaListStatus(row.status),
        rating: toNumber(row.rating),
        season_count: seasons.length,
        episode_count: seasons.reduce((sum, season) => sum + (season.episodes?.[0]?.count ?? 0), 0),
        track_count:
          mediaType === "album"
            ? (resolveAlbumTrackCount(trackCountByAlbum.get(row.id) ?? 0, storedTrackCountByAlbum.get(row.id)) ?? 0)
            : 0,
      };
    }),
    total: page.total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * 季和单集列表补详情时实际用到的列。
 * 不读 runtime，也不嵌入所属节目下的全部季：那一次还会为每一季再数一遍单集，列表并不展示。
 */
const CHILD_DETAIL_COLUMNS = [
  "id,title,alternate_title,type,cover_url,release_date",
  "tracking(status,rating)",
  "tv_seasons!tv_seasons_id_fkey(season_number,parent:media_items!tv_seasons_series_id_fkey(title),episodes:tv_episodes!tv_episodes_season_id_fkey(count))",
  "tv_episodes!tv_episodes_id_fkey(episode_number,parent:tv_seasons!tv_episodes_season_id_fkey(media_items!tv_seasons_id_fkey(title),series:media_items!tv_seasons_series_id_fkey(title)))",
].join(",");

type ChildOrderRow = {
  id: string;
  status: string | null;
  rating: number | string | null;
  sort_date: string | null;
};

type TrackingEmbed = { status?: string | null; rating?: number | string | null };

type ChildDetailRow = {
  id: string;
  title: string | null;
  alternate_title: string | null;
  type: string | null;
  cover_url: string | null;
  release_date: string | null;
  tracking: TrackingEmbed | TrackingEmbed[] | null;
  tv_seasons: {
    season_number?: number | string | null;
    parent?: { title?: string | null } | null;
    episodes?: { count?: number | string | null }[] | null;
  } | null;
  tv_episodes: {
    episode_number?: number | string | null;
    parent?: {
      media_items?: { title?: string | null } | null;
      series?: { title?: string | null } | null;
    } | null;
  } | null;
};

/** 主排序之后仍按播出日期、季号或集号、标题和 ID 固定次序，避免同值记录翻页时跳动。 */
function orderChildren<Query extends { order: (column: string, options?: OrderOptions) => Query }>(
  query: Query,
  sort: ChildSortKey,
) {
  const primary =
    sort === "title"
      ? query.order("title")
      : sort === "rating"
        ? query.order("rating", { ascending: false, nullsFirst: false })
        : query;
  return primary
    .order("sort_date", { ascending: false, nullsFirst: false })
    .order("item_number", { ascending: false, nullsFirst: false })
    .order("title")
    .order("id");
}

function seasonContext(embed: NonNullable<ChildDetailRow["tv_seasons"]>): ChildSeasonContext {
  return {
    seriesTitle: embed.parent?.title ?? null,
    seasonNumber: Number(embed.season_number),
    episodeCount: Number(embed.episodes?.[0]?.count ?? 0),
  };
}

function episodeContext(embed: NonNullable<ChildDetailRow["tv_episodes"]>): ChildEpisodeContext {
  return {
    seriesTitle: embed.parent?.series?.title ?? null,
    seasonTitle: embed.parent?.media_items?.title ?? null,
    episodeNumber: Number(embed.episode_number),
  };
}

function childPage(query: ParsedAdminChildQuery, items: ChildListItem[], total: number): AdminChildListResult {
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    q: query.q,
    sort: query.sort,
    status: query.status,
    parent: query.parent,
  };
}

/**
 * 分页读取某一季列表、单集列表或专辑曲目列表。
 * 季／单集：筛选、排序和精确计数在 v_manage_media_order 上完成。
 * 曲目：music.album_id 不在该视图 parent_id 中，改走 listAdminTracks。
 * 调用方必须已经通过 requireOwner()。
 */
export async function listAdminChildren(
  db: SupabaseClient,
  type: unknown,
  parent: unknown,
  input?: AdminChildListInput | null,
): Promise<AdminChildListResult> {
  const mediaType: AdminChildListType = parseAdminChildListType(type);
  if (mediaType === "music") return listAdminTracks(db, parent, input);
  const query = parseAdminChildQuery(mediaType, parent, input);
  const start = (query.page - 1) * query.pageSize;
  let request = db
    .from("v_manage_media_order")
    .select("id, status, rating, sort_date", { count: "exact" })
    .eq("type", mediaType);
  if (query.q) request = request.or(titleOrAliasFilter(query.q));
  if (query.parent) request = request.eq("parent_id", query.parent);
  if (query.status) request = request.eq("status", query.status);
  const ordered = await orderChildren(request, query.sort).range(start, start + query.pageSize - 1);
  if (ordered.error) throw new Error(CHILD_LIST_READ_ERROR);
  const orderedRows = (ordered.data ?? []) as ChildOrderRow[];
  const total = ordered.count ?? 0;
  const ids = orderedRows.map((row) => row.id);
  if (ids.length === 0) return childPage(query, [], total);
  const details = readRows<ChildDetailRow>(
    await db.from("media_items").select(CHILD_DETAIL_COLUMNS).in("id", ids),
    CHILD_LIST_READ_ERROR,
  );
  const orderById = new Map(orderedRows.map((row) => [row.id, row]));
  const position = new Map(ids.map((id, index) => [id, index]));
  const items = [...details]
    .sort((left, right) => (position.get(left.id) ?? 0) - (position.get(right.id) ?? 0))
    .map((detail) => {
      const order = orderById.get(detail.id);
      const rowType: AdminChildListType =
        detail.type === "tv_season" || detail.type === "tv_episode" ? detail.type : mediaType;
      const tracking = Array.isArray(detail.tracking) ? detail.tracking[0] : detail.tracking;
      const season = rowType === "tv_season";
      return {
        id: detail.id,
        type: rowType,
        title: detail.title ?? "",
        alternate_title: detail.alternate_title,
        cover_url: detail.cover_url,
        display_date: season ? order?.sort_date || null : detail.release_date,
        status: childWatchStatus(season ? order?.status : tracking?.status),
        rating: season || tracking?.rating == null ? null : Number(tracking.rating),
        season: detail.tv_seasons ? seasonContext(detail.tv_seasons) : null,
        episode: !detail.tv_seasons && detail.tv_episodes ? episodeContext(detail.tv_episodes) : null,
        track: null,
      };
    });
  return childPage(query, items, total);
}

type TrackListRow = {
  media_item_id: string;
  track_number: number | null;
  media:
    | {
        id: string;
        title: string | null;
        alternate_title: string | null;
        cover_url: string | null;
        release_date: string | null;
        tracking:
          | { status?: string | null; rating?: number | string | null }
          | { status?: string | null; rating?: number | string | null }[]
          | null;
      }
    | Array<{
        id: string;
        title: string | null;
        alternate_title: string | null;
        cover_url: string | null;
        release_date: string | null;
        tracking:
          | { status?: string | null; rating?: number | string | null }
          | { status?: string | null; rating?: number | string | null }[]
          | null;
      }>
    | null;
};

/**
 * 读取某专辑下的曲目并在内存中筛选／排序／分页。
 * 专辑曲目量通常很小；v_manage_media_order 的 parent_id 不含 music.album_id。
 * 调用方必须已经通过 requireOwner()。
 */
export async function listAdminTracks(
  db: SupabaseClient,
  parent: unknown,
  input?: AdminChildListInput | null,
): Promise<AdminChildListResult> {
  const query = parseAdminChildQuery("music", parent, input);
  if (!query.parent) return childPage(query, [], 0);

  const { data: album, error: albumError } = await db
    .from("media_items")
    .select("title")
    .eq("id", query.parent)
    .eq("type", "album")
    .maybeSingle();
  if (albumError) throw new Error(CHILD_LIST_READ_ERROR);
  const albumTitle = album?.title ?? null;

  const rows = readRows<TrackListRow>(
    await db
      .from("music")
      .select(
        "media_item_id,track_number,media:media_items!music_media_item_id_fkey(id,title,alternate_title,cover_url,release_date,tracking(status,rating))",
      )
      .eq("album_id", query.parent)
      .order("track_number", { ascending: true, nullsFirst: false })
      .order("media_item_id", { ascending: true }),
    CHILD_LIST_READ_ERROR,
  );

  const needle = query.q.trim().toLowerCase();
  let items: ChildListItem[] = rows.map((row) => {
    const media = Array.isArray(row.media) ? row.media[0] : row.media;
    const tracking = Array.isArray(media?.tracking) ? media?.tracking[0] : media?.tracking;
    return {
      id: row.media_item_id,
      type: "music" as const,
      title: media?.title ?? "",
      alternate_title: media?.alternate_title ?? null,
      cover_url: media?.cover_url ?? null,
      display_date: media?.release_date ?? null,
      status: childWatchStatus(tracking?.status),
      rating: tracking?.rating == null ? null : Number(tracking.rating),
      season: null,
      episode: null,
      track: {
        albumTitle,
        trackNumber: Number(row.track_number ?? 0),
      },
    };
  });

  if (needle) {
    items = items.filter(
      (item) =>
        item.title.toLowerCase().includes(needle) || (item.alternate_title ?? "").toLowerCase().includes(needle),
    );
  }
  if (query.status) items = items.filter((item) => item.status === query.status);

  if (query.sort === "rating") {
    items = [...items].sort(
      (left, right) =>
        (right.rating ?? -1) - (left.rating ?? -1) ||
        left.title.localeCompare(right.title, "zh-CN") ||
        left.id.localeCompare(right.id),
    );
  } else if (query.sort === "title") {
    items = [...items].sort(
      (left, right) => left.title.localeCompare(right.title, "zh-CN") || left.id.localeCompare(right.id),
    );
  } else {
    items = [...items].sort(
      (left, right) =>
        (left.track?.trackNumber ?? 0) - (right.track?.trackNumber ?? 0) || left.id.localeCompare(right.id),
    );
  }

  const total = items.length;
  const start = (query.page - 1) * query.pageSize;
  return childPage(query, items.slice(start, start + query.pageSize), total);
}
