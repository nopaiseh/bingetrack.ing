import { getSupabasePublicServer } from "@/lib/supabase/public-server";
import { mapViewRowToMediaCard } from "@/lib/functions/media-mapper";
import { buildMediaDistributions, type DistributionCountRow } from "@/lib/functions/media-distributions";
import { withRetry } from "@/lib/functions/retry";
import { withAlbumCoversForTracks } from "@/lib/music/track-display-cover";
import { MediaCard, MediaDistributions, UpcomingRelease, ViewAllMediaRow, FetchMediaListOptions } from "@/lib/types";
import { SEARCH_DB_TYPES, publicMediaDetailPath, publicPathForDbType, publicPersonDetailPath } from "@/lib/media-types";
import type { AlbumStats, BookStats } from "./types";
import {
  MEDIA_CARD_COLUMNS,
  TOP_MEDIA_COLUMNS,
  WATCH_STATUSES,
  MediaRepositoryError,
  addSeriesReleaseYearRanges,
  firstRelated,
} from "./shared";

type SitemapMediaEntry = {
  path: string;
};

const SITEMAP_PAGE_SIZE = 1_000;

// get_person_works 可公开展示的媒体类型（与 SEARCH_DB_TYPES 一致：影视／专辑／歌曲／图书）。
const SITEMAP_PERSON_MEDIA_TYPES = [...SEARCH_DB_TYPES];

// 按 ID 分批读取目录媒体、歌曲、季与有公开作品的人物地址，避免单次查询行数上限截断站点地图。
export async function getSitemapMediaEntries(): Promise<SitemapMediaEntry[]> {
  return withRetry(async () => {
    const db = getSupabasePublicServer();
    const entries: SitemapMediaEntry[] = [];

    // 目录类型 + music：与公开搜索／详情路径一致；v_all_media 中 type=music 即可打开 /music/<id>。
    for (let offset = 0; ; offset += SITEMAP_PAGE_SIZE) {
      const { data, error } = await db
        .from("v_all_media")
        .select("id, type")
        .in("type", [...SEARCH_DB_TYPES])
        .order("id", { ascending: true })
        .range(offset, offset + SITEMAP_PAGE_SIZE - 1);

      if (error) {
        console.error("Failed to fetch media routes for sitemap:", error);
        throw new MediaRepositoryError("fetch sitemap media routes", error);
      }

      const rows = data ?? [];
      entries.push(
        ...rows.flatMap(
          /* 根据媒体类型构造详情路径，并对 ID 做 URL 编码。 */ (row) => {
            const path = publicPathForDbType(String(row.type), String(row.id));
            return path ? [{ path }] : [];
          },
        ),
      );

      if (rows.length < SITEMAP_PAGE_SIZE) break;
    }

    for (let offset = 0; ; offset += SITEMAP_PAGE_SIZE) {
      const { data, error } = await db
        .from("tv_seasons")
        .select("id, series_id")
        .order("id", { ascending: true })
        .range(offset, offset + SITEMAP_PAGE_SIZE - 1);

      if (error) {
        console.error("Failed to fetch season routes for sitemap:", error);
        throw new MediaRepositoryError("fetch sitemap season routes", error);
      }

      const rows = data ?? [];
      entries.push(
        ...rows.map(
          /* 对电视节目和季 ID 编码后构造季详情路径。 */ (row) => ({
            path: `/shows/${encodeURIComponent(String(row.series_id))}/seasons/${encodeURIComponent(String(row.id))}`,
          }),
        ),
      );

      if (rows.length < SITEMAP_PAGE_SIZE) break;
    }

    // 人物：至少一条可公开展示作品（挂在 movie／tv_show／album／music／book 上的 credits）。
    // people 为根表 + !inner，按人物 ID 分页，避免按 credits 行分页时重复／漏人。
    for (let offset = 0; ; offset += SITEMAP_PAGE_SIZE) {
      const { data, error } = await db
        .from("people")
        .select("id, media_credits!inner(media_item_id, media_items!inner(type))")
        .in("media_credits.media_items.type", SITEMAP_PERSON_MEDIA_TYPES)
        .order("id", { ascending: true })
        .range(offset, offset + SITEMAP_PAGE_SIZE - 1);

      if (error) {
        console.error("Failed to fetch people routes for sitemap:", error);
        throw new MediaRepositoryError("fetch sitemap people routes", error);
      }

      const rows = data ?? [];
      entries.push(
        ...rows.map(
          /* 对人物 ID 编码后构造公开人物页路径。 */ (row) => ({
            path: publicPersonDetailPath(String(row.id)),
          }),
        ),
      );

      if (rows.length < SITEMAP_PAGE_SIZE) break;
    }

    return entries;
  });
}

/** 获取指定类型的评分榜单；年度电视节目按当年单集评分排名，并补充电视节目年份范围。专辑／图书与电影同路径（按 type 过滤，不含单曲）。 */
export async function fetchTopMediaServer(
  mediaType: "movie" | "tv_show" | "album" | "book",
  year?: string | null,
  limit = 10,
): Promise<MediaCard[]> {
  return withRetry(async () => {
    const db = getSupabasePublicServer();

    if (mediaType === "tv_show" && year) {
      type RankedSeriesRow = {
        series_id: string;
        year_rating: number | string | null;
      };

      // 按年份查看电视节目榜单时，由数据库按当年单集评分排名，再补齐卡片信息。
      const { data: rankedData, error: rankingError } = await db.rpc("get_top_tv_shows_by_year", {
        p_year: Number(year),
        p_limit: limit,
      });

      if (rankingError || !rankedData) {
        if (rankingError) console.error(`Failed to rank TV series released in ${year}:`, rankingError);
        throw new MediaRepositoryError("rank year-specific TV series", rankingError);
      }

      const rankedRows = rankedData as RankedSeriesRow[];
      const seriesIds = rankedRows.map(/* 提取数据库排名返回的电视节目 ID。 */ (row) => row.series_id);
      if (seriesIds.length === 0) return [];

      const ratingsBySeries = new Map(
        rankedRows.map(
          /* 将电视节目 ID 和可为空的年度评分组成查找表条目。 */ (row) => [
            row.series_id,
            row.year_rating === null ? null : Number(row.year_rating),
          ],
        ),
      );

      const { data: seriesData, error: seriesError } = await db
        .from("v_all_media")
        .select(TOP_MEDIA_COLUMNS)
        .eq("type", "tv_show")
        .in("id", seriesIds);

      if (seriesError || !seriesData) {
        if (seriesError) console.error(`Failed to fetch TV series released in ${year}:`, seriesError);
        throw new MediaRepositoryError("fetch year-specific TV series", seriesError);
      }

      const rankedSeries = (seriesData as ViewAllMediaRow[])
        .map(
          /* 将电视节目视图行转成卡片，并把评分替换为所选年份的评分。 */ (item) => {
            const yearRating = ratingsBySeries.get(String(item.id)) ?? null;
            return {
              ...mapViewRowToMediaCard(item),
              rating: yearRating,
              ...(item.summary ? { summary: item.summary } : {}),
            };
          },
        )
        .sort(
          /* 按年度评分降序排列，缺失评分置后，同分时按 ID 排序。 */ (left, right) =>
            (right.rating ?? -1) - (left.rating ?? -1) || left.id.localeCompare(right.id),
        );
      return addSeriesReleaseYearRanges(db, rankedSeries);
    }

    let query = db
      .from("v_all_media")
      .select(TOP_MEDIA_COLUMNS)
      .eq("type", mediaType)
      .order("rating", { ascending: false, nullsFirst: false })
      // 同分时按 ID 排序，保证榜单名次稳定。
      .order("id", { ascending: true })
      .limit(limit);

    if (year) {
      query = query.gte("sort_date", `${year}-01-01`).lte("sort_date", `${year}-12-31`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to fetch top media:", error);
      throw new MediaRepositoryError("fetch top media", error);
    }
    if (!data) return [];

    const items = data.map(
      /* 将榜单视图行转换为媒体卡片。 */ (item: ViewAllMediaRow) => ({
        ...mapViewRowToMediaCard(item),
        ...(item.summary ? { summary: item.summary } : {}),
      }),
    );
    return mediaType === "tv_show" ? addSeriesReleaseYearRanges(db, items) : items;
  });
}

// 首页缓存可能滞后一两天，每部剧多取几集、电影多取几部，浏览器按当天过滤后仍能补位。
const UPCOMING_MOVIE_LIMIT = 12;
const UPCOMING_EPISODE_POOL = 60;
const UPCOMING_EPISODES_PER_SHOW = 3;
// 倒计时展台只要标题／封面／类型／语言／简介与上映日；不拉榜单用的评分、状态、作者等列。
const UPCOMING_VIEW_COLUMNS = "id,type,title,sort_date,genres,languages,cover_url,summary";

type UpcomingEpisodeRow = {
  id: string;
  title: string | null;
  release_date: string;
  tv_episodes:
    | {
        season_id: string;
        episode_number: number;
        tv_seasons:
          { season_number: number; series_id: string } | Array<{ season_number: number; series_id: string }> | null;
      }
    | Array<{
        season_id: string;
        episode_number: number;
        tv_seasons:
          { season_number: number; series_id: string } | Array<{ season_number: number; series_id: string }> | null;
      }>
    | null;
};

/** 返回 UTC 昨天的日期，作为候选下限，让比 UTC 慢的时区仍能看到当地“今天”上映的条目。 */
function upcomingLowerBound(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

/** 读取即将上映的电影和即将播出的单集，组成首页倒计时展台的候选池；精确的当天过滤交给浏览器。 */
export async function fetchUpcomingReleasesServer(): Promise<UpcomingRelease[]> {
  return withRetry(async () => {
    const db = getSupabasePublicServer();
    const since = upcomingLowerBound();

    const [moviesRes, episodesRes] = await Promise.all([
      db
        .from("v_all_media")
        .select(UPCOMING_VIEW_COLUMNS)
        .eq("type", "movie")
        .gte("sort_date", since)
        .order("sort_date", { ascending: true })
        .order("id", { ascending: true })
        .limit(UPCOMING_MOVIE_LIMIT),
      db
        .from("media_items")
        .select(
          "id,title,release_date,tv_episodes!inner(season_id,episode_number,tv_seasons!inner(season_number,series_id))",
        )
        .eq("type", "tv_episode")
        .gte("release_date", since)
        .order("release_date", { ascending: true })
        .order("id", { ascending: true })
        .limit(UPCOMING_EPISODE_POOL),
    ]);

    if (moviesRes.error || episodesRes.error) {
      console.error("Failed to fetch upcoming releases:", moviesRes.error ?? episodesRes.error);
      throw new MediaRepositoryError("fetch upcoming releases", moviesRes.error ?? episodesRes.error);
    }

    const movies = ((moviesRes.data ?? []) as ViewAllMediaRow[]).map(
      /* 将电影视图行转换为倒计时条目。 */ (row): UpcomingRelease => {
        const card = mapViewRowToMediaCard(row);
        return {
          id: card.id,
          kind: "movie",
          groupId: card.id,
          title: card.title,
          releaseDate: String(row.sort_date),
          cover_url: card.cover_url,
          href: publicMediaDetailPath("movies", card.id),
          genres: card.genres,
          languages: card.languages,
          ...(row.summary ? { summary: row.summary } : {}),
        };
      },
    );

    // 每部剧只保留最早的几集，控制候选池大小。
    const perShow = new Map<string, number>();
    const episodes = ((episodesRes.data ?? []) as UpcomingEpisodeRow[]).flatMap(
      /* 展开单集所属季与剧，超出每剧上限的单集丢弃。 */ (row) => {
        const episode = firstRelated(row.tv_episodes);
        const season = firstRelated(episode?.tv_seasons);
        if (!episode || !season) return [];
        const count = perShow.get(season.series_id) ?? 0;
        if (count >= UPCOMING_EPISODES_PER_SHOW) return [];
        perShow.set(season.series_id, count + 1);
        return [
          {
            row,
            seasonId: episode.season_id,
            episodeNumber: episode.episode_number,
            seasonNumber: season.season_number,
            seriesId: season.series_id,
          },
        ];
      },
    );

    const seriesIds = [...perShow.keys()];
    let seriesById = new Map<string, ViewAllMediaRow>();
    if (seriesIds.length > 0) {
      const { data, error } = await db
        .from("v_all_media")
        .select(UPCOMING_VIEW_COLUMNS)
        .eq("type", "tv_show")
        .in("id", seriesIds);
      if (error) {
        console.error("Failed to fetch upcoming series:", error);
        throw new MediaRepositoryError("fetch upcoming series", error);
      }
      seriesById = new Map(
        ((data ?? []) as ViewAllMediaRow[]).map(/* 以剧集 ID 建立查找表。 */ (row) => [String(row.id), row]),
      );
    }

    const shows = episodes.flatMap(
      /* 用所属剧的标题、海报和简介补全单集条目。 */ ({
        row,
        seasonId,
        episodeNumber,
        seasonNumber,
        seriesId,
      }): UpcomingRelease[] => {
        const series = seriesById.get(seriesId);
        if (!series) return [];
        const card = mapViewRowToMediaCard(series);
        const code = `第 ${seasonNumber} 季 · 第 ${episodeNumber} 集`;
        return [
          {
            id: String(row.id),
            kind: "episode",
            groupId: card.id,
            title: card.title,
            subtitle: row.title ? `${code} · ${row.title}` : code,
            releaseDate: row.release_date,
            cover_url: card.cover_url,
            href: `/shows/${encodeURIComponent(card.id)}/seasons/${encodeURIComponent(seasonId)}`,
            genres: card.genres,
            languages: card.languages,
            ...(series.summary ? { summary: series.summary } : {}),
          },
        ];
      },
    );

    return [...movies, ...shows].sort(
      /* 按上映日期升序合并两类条目。 */ (left, right) =>
        left.releaseDate.localeCompare(right.releaseDate) || left.id.localeCompare(right.id),
    );
  });
}

/** 调用分布计数 RPC，再转换为按媒体类型和年份组织的前五名统计。 */
export async function fetchMediaDistributionsServer(): Promise<MediaDistributions> {
  return withRetry(async () => {
    const db = getSupabasePublicServer();

    const { data, error } = await db.rpc("get_media_distribution_counts");
    if (error || !data) {
      if (error) console.error("Failed to fetch media distribution counts:", error);
      throw new MediaRepositoryError("fetch media distribution counts", error);
    }

    return buildMediaDistributions(data as DistributionCountRow[]);
  });
}

/** 使用统一列表查询执行搜索，返回卡片与精确总数。 */
export async function searchMediaServer(
  opts: FetchMediaListOptions = {},
): Promise<{ rows: MediaCard[]; total: number }> {
  return withRetry(async () => fetchMediaList(opts));
}

// 目录页另有统计查询，此处只取卡片，跳过精确总数查询。
export async function fetchMediaCardsServer(opts: FetchMediaListOptions = {}): Promise<MediaCard[]> {
  return withRetry(async () => (await fetchMediaList(opts, false)).rows);
}

/** 按关键词与分类取得候选条目，统一应用属性筛选与稳定排序，再分页读取卡片并按需查询总数。 */
async function fetchMediaList(
  opts: FetchMediaListOptions,
  includeTotal = true,
): Promise<{ rows: MediaCard[]; total: number }> {
  const db = getSupabasePublicServer();
  const {
    type,
    seriesOnly = false,
    creditRole,
    status,
    upcoming = false,
    genre,
    region,
    language,
    startYear,
    endYear,
    q,
    sort,
    limit = 30,
    offset = 0,
  } = opts || {};

  const types = type?.split(",").filter(Boolean) ?? [];
  const creditRoles =
    creditRole?.split(",").filter(
      /* 接受目录可搜的演职员角色：导演／演员／作者／艺人／作词／作曲。 */
      (role) =>
        role === "director" ||
        role === "actor" ||
        role === "author" ||
        role === "artist" ||
        role === "lyricist" ||
        role === "composer",
    ) ?? [];
  const hasQuery = typeof q === "string" && q.trim().length > 0;
  // 关键词和“系列”分类的匹配需要跨表合并，交给数据库函数完成，避免把命中 ID 回传到 URL 而被截断。
  const usesSearchFunction = hasQuery || seriesOnly;
  // search_media 在同时传入系列与媒体类型且无人物角色时用 OR 合并；无人物时改为只让 RPC
  // 做系列匹配，再由 PostgREST 叠加类型，得到系列 ∩ 类型（与人物路径的 AND 一致）。
  const andSeriesWithType = seriesOnly && types.length > 0 && creditRoles.length === 0;
  // 无关键词时省略 p_query 使用函数默认值：计数请求走 HEAD 查询串，null 会被序列化成字符串 "null"。
  const searchArgs = {
    ...(hasQuery ? { p_query: q.trim() } : {}),
    p_types: andSeriesWithType ? [] : types,
    p_series_only: seriesOnly,
    p_credit_roles: creditRoles,
  };
  /** 从搜索函数或列表视图选取字段，二者返回相同的 v_all_media 行，后续筛选可共用。 */
  const source = (columns: string, options?: { count: "exact"; head: true }) =>
    usesSearchFunction
      ? db.rpc("search_media", searchArgs, options).select(columns)
      : db.from("v_all_media").select(columns, options);

  let dataQuery = source(MEDIA_CARD_COLUMNS);
  let countQuery = source("id", { count: "exact", head: true });

  if ((!usesSearchFunction || andSeriesWithType) && types.length > 0) {
    dataQuery = dataQuery.in("type", types);
    countQuery = countQuery.in("type", types);
  }
  // 数据查询与计数查询使用相同筛选条件，保证分页总数对应当前结果集。
  // “即将上映”与观看状态同属状态筛选，多选时按任一满足合并；电影的 last_air_date 即上映日期，剧集为最后一集播出日期。
  // 状态值会拼进 .or() 表达式，这里再按允许值过滤一次，不依赖调用方已经校验。
  const statuses =
    status?.split(",").filter(/* 只保留视图实际使用的观看状态。 */ (value) => WATCH_STATUSES.has(value)) ?? [];
  if (upcoming) {
    const upcomingFilter = `last_air_date.gte.${new Date().toISOString().slice(0, 10)}`;
    const filter = statuses.length > 0 ? `status.in.(${statuses.join(",")}),${upcomingFilter}` : upcomingFilter;
    dataQuery = dataQuery.or(filter);
    countQuery = countQuery.or(filter);
  } else if (statuses.length > 0) {
    dataQuery = dataQuery.in("status", statuses);
    countQuery = countQuery.in("status", statuses);
  }
  if (genre) {
    const genres = genre.split(",");
    dataQuery = dataQuery.overlaps("genres", genres);
    countQuery = countQuery.overlaps("genres", genres);
  }
  if (region) {
    const regions = region.split(",");
    dataQuery = dataQuery.overlaps("regions", regions);
    countQuery = countQuery.overlaps("regions", regions);
  }
  if (language) {
    const languages = language.split(",");
    dataQuery = dataQuery.overlaps("languages", languages);
    countQuery = countQuery.overlaps("languages", languages);
  }
  if (startYear) {
    dataQuery = dataQuery.gte("last_air_date", `${startYear}-01-01`);
    countQuery = countQuery.gte("last_air_date", `${startYear}-01-01`);
  }
  if (endYear) {
    dataQuery = dataQuery.lte("first_air_date", `${endYear}-12-31`);
    countQuery = countQuery.lte("first_air_date", `${endYear}-12-31`);
  }

  if (sort) {
    const [field, order] = sort.split("_");
    const ascending = order === "asc";

    if (field === "date") {
      dataQuery = dataQuery
        .order("sort_date", { ascending, nullsFirst: false })
        .order("first_air_date", { ascending, nullsFirst: false });
    } else if (field === "rating") {
      dataQuery = dataQuery.order("rating", { ascending, nullsFirst: false });
    }
  } else {
    dataQuery = dataQuery
      .order("sort_date", { ascending: false, nullsFirst: false })
      .order("first_air_date", { ascending: false, nullsFirst: false });
  }

  // 用唯一 ID 打破日期或评分相同时的排序平局，防止跨页重复或漏项。
  dataQuery = dataQuery.order("id", { ascending: true });

  dataQuery = dataQuery.range(offset, offset + limit - 1);

  const [dataRes, countRes] = await Promise.all([
    dataQuery,
    includeTotal ? countQuery : Promise.resolve({ count: null, error: null }),
  ]);

  if (dataRes.error || countRes.error) {
    console.error("Failed to fetch media list:", dataRes.error ?? countRes.error);
    throw new MediaRepositoryError("fetch media list", dataRes.error ?? countRes.error);
  }

  const total = countRes.count ?? 0;
  const data = dataRes.data;

  if (!data) return { rows: [], total };

  const mappedResults: MediaCard[] = (data as unknown as ViewAllMediaRow[]).map(
    /* 将分页查询结果转换为卡片对象。 */ (item) => mapViewRowToMediaCard(item),
  );
  let withTrackCovers: MediaCard[];
  try {
    // 曲目卡片展示所属专辑封面；专辑无图时为空串，走色块首字。
    const covered = await withAlbumCoversForTracks(db, mappedResults);
    withTrackCovers = covered.map((card) => ({ ...card, cover_url: card.cover_url ?? "" }));
  } catch (error) {
    throw new MediaRepositoryError("fetch track album covers", error);
  }
  const results = await addSeriesReleaseYearRanges(db, withTrackCovers);

  return { rows: results, total };
}

// 读取数据库的媒体状态统计，并将可能以字符串返回的计数转换为数字。
// 影视目录只消费既有五列；in_progress 由 getBookStats 单独映射。
export async function fetchStatsServer(mediaType: "movie" | "tv_show") {
  return withRetry(async () => {
    const db = getSupabasePublicServer();
    const { data, error } = await db.rpc("get_media_stats", { p_media_type: mediaType });
    if (error || !data?.[0]) {
      if (error) console.error("Failed to fetch media stats:", error);
      throw new MediaRepositoryError("fetch media stats", error);
    }
    const stats = data[0] as Record<"total" | "watched" | "watching" | "want" | "upcoming", number | string>;

    return {
      total: Number(stats.total),
      watched: Number(stats.watched),
      watching: Number(stats.watching),
      want: Number(stats.want),
      upcoming: Number(stats.upcoming),
    };
  });
}

// 一次 RPC 取回图书四项计数；want 列映射为 wantToWatch，in_progress 映射为 inProgress。
export async function getBookStats(): Promise<BookStats> {
  return withRetry(async () => {
    const db = getSupabasePublicServer();
    const { data, error } = await db.rpc("get_media_stats", { p_media_type: "book" });
    if (error || !data?.[0]) {
      if (error) console.error("Failed to fetch book stats:", error);
      throw new MediaRepositoryError("fetch book stats", error);
    }
    const stats = data[0] as Record<"total" | "watched" | "want" | "in_progress", number | string>;

    return {
      total: Number(stats.total),
      inProgress: Number(stats.in_progress),
      watched: Number(stats.watched),
      wantToWatch: Number(stats.want),
    };
  });
}

const EMPTY_ALBUM_STATS: AlbumStats = {
  total: 0,
  watched: 0,
  watching: 0,
  want: 0,
  trackTotal: 0,
};

// 两次 get_media_stats：album 取四项状态计数，music 只取 total 作为 trackTotal。
// 空库时 RPC 聚合仍返回一行 0；若行缺失也回退为零，不抛错。
export async function getAlbumStats(): Promise<AlbumStats> {
  return withRetry(async () => {
    const db = getSupabasePublicServer();
    const [albumResult, musicResult] = await Promise.all([
      db.rpc("get_media_stats", { p_media_type: "album" }),
      db.rpc("get_media_stats", { p_media_type: "music" }),
    ]);

    if (albumResult.error) {
      console.error("Failed to fetch album stats:", albumResult.error);
      throw new MediaRepositoryError("fetch album stats", albumResult.error);
    }
    if (musicResult.error) {
      console.error("Failed to fetch album track stats:", musicResult.error);
      throw new MediaRepositoryError("fetch album stats", musicResult.error);
    }

    const album = albumResult.data?.[0] as
      Record<"total" | "watched" | "watching" | "want", number | string> | undefined;
    const music = musicResult.data?.[0] as Record<"total", number | string> | undefined;

    if (!album && !music) return EMPTY_ALBUM_STATS;

    return {
      total: Number(album?.total ?? 0),
      watched: Number(album?.watched ?? 0),
      watching: Number(album?.watching ?? 0),
      want: Number(album?.want ?? 0),
      trackTotal: Number(music?.total ?? 0),
    };
  });
}
