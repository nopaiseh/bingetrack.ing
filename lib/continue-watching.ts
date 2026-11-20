import "server-only";

import { MediaRepositoryError } from "@/lib/functions/media-repo";
import { MEDIA_TYPE_DEFINITIONS } from "@/lib/media-types";
import { withRetry } from "@/lib/functions/retry";
import { nextUnwatchedAfterLastWatched } from "@/lib/season-browse";
import { getSupabasePublicServer } from "@/lib/supabase/public-server";

/** 首页「继续看」最多返回的电视节目数。 */
export const CONTINUE_WATCHING_LIMIT = 8;

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
const SHOW_ID_CHUNK = 100;
const MISSING_RELEASE_INSTANT = "1970-01-01T00:00:00.000Z";
const RELEASE_DATE = /^(\d{4}-\d{2}-\d{2})/;
const TMDB_POSTER_PATH = /^https:\/\/image\.tmdb\.org\/t\/p\/[^/]+(\/[^?#]+)/;

const EPISODE_COLUMNS =
  "episode_number,season:tv_seasons!tv_episodes_season_id_fkey!inner(id,series_id,season_number),media:media_items!tv_episodes_id_fkey(title,release_date,tracking(status))";

/**
 * 首页「继续看」的一条电视节目。
 * `posterPath` 是 TMDB 尺寸段之后的原始路径，由前端自己拼宽度；不是 TMDB 地址时为 null。
 * `lastWatchedAt` 没有独立的观看时间列：取进度最前缘那一集的上映日，记为 UTC 零点。
 * 那一集没有上映日时，改用已看单集里最晚的上映日；仍然没有则为 Unix 纪元。
 */
export type ContinueWatchingItem = {
  showId: string;
  title: string;
  posterPath: string | null;
  href: string;
  nextEpisode: {
    seasonNumber: number;
    episodeNumber: number;
    title: string | null;
    href: string;
  } | null;
  seasonProgress: {
    seasonNumber: number;
    watched: number;
    total: number;
  };
  lastWatchedAt: string;
};

type EpisodeProgress = {
  showId: string;
  seasonId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string | null;
  releaseDate: string | null;
  status: string | null;
};

export type ContinueWatchingShow = {
  showId: string;
  title: string;
  coverUrl: string | null;
  episodes: readonly EpisodeProgress[];
};

type ShowRow = {
  id: string;
  title: string | null;
  cover_url: string | null;
};

type Related<T> = T | T[] | null;

type EpisodeRow = {
  episode_number: number | string;
  season: Related<{
    id: string;
    series_id: string;
    season_number: number | string;
  }>;
  media: Related<{
    title: string | null;
    release_date: string | null;
    tracking: Related<{ status: string | null }>;
  }>;
};

/** 关联查询可能返回对象或数组，统一取第一项。 */
function firstRelated<T>(value: Related<T> | undefined): T | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

/** 空白标题视为没有标题，让前端自行决定占位文案。 */
function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** 把 YYYY-MM-DD 上映日收成 UTC 零点；无法识别时返回 null。 */
function releaseDateToUtc(value: string | null): string | null {
  const match = value?.match(RELEASE_DATE);
  return match ? `${match[1]}T00:00:00.000Z` : null;
}

const MUSIC_COVER_HOST = /^https:\/\/(?:[\w.-]+\.)?(?:mzstatic\.com|coverartarchive\.org|archive\.org)(?:\/|$)/i;

/** 从完整 TMDB 地址取出尺寸段之后的路径；已知音乐封面主机与站内相对路径原样保留。 */
export function posterPathFromCover(coverUrl: string | null): string | null {
  const cover = coverUrl?.trim();
  if (!cover) return null;
  const tmdbPath = cover.match(TMDB_POSTER_PATH)?.[1];
  if (tmdbPath) return tmdbPath;
  if (MUSIC_COVER_HOST.test(cover)) return cover;
  if (cover.startsWith("/") && !cover.startsWith("//")) return cover;
  return null;
}

/** 季号在前、集号在后。更早的季里被跳过的集，排在更后的已看集之前。 */
function compareEpisodeOrder(left: EpisodeProgress, right: EpisodeProgress): number {
  return left.seasonNumber - right.seasonNumber || left.episodeNumber - right.episodeNumber;
}

/** 进度最前缘那一集的上映日；缺失时退到任一已看单集的最晚上映日。 */
function lastWatchedInstant(lastWatched: EpisodeProgress, episodes: readonly EpisodeProgress[]): string {
  const own = releaseDateToUtc(lastWatched.releaseDate);
  if (own) return own;

  let latest: string | null = null;
  for (const episode of episodes) {
    if (episode.status !== "watched") continue;
    const instant = releaseDateToUtc(episode.releaseDate);
    if (instant && (latest === null || instant > latest)) latest = instant;
  }
  return latest ?? MISSING_RELEASE_INSTANT;
}

/**
 * 把已经读出的在看节目收成首页条目。
 * 没有已看单集的节目没有进度前缘，无法给出下一集和最后观看季，直接略过。
 * 同一时间按节目 ID 升序，结果截到上限。
 */
export function assembleContinueWatching(shows: readonly ContinueWatchingShow[]): ContinueWatchingItem[] {
  const items: ContinueWatchingItem[] = [];

  for (const show of shows) {
    const progress = nextUnwatchedAfterLastWatched(show.episodes, compareEpisodeOrder);
    if (!progress) continue;

    const focus = progress.next ?? progress.lastWatched;
    const seasonEpisodes = show.episodes.filter((episode) => episode.seasonNumber === focus.seasonNumber);
    items.push({
      showId: show.showId,
      title: show.title.trim(),
      posterPath: posterPathFromCover(show.coverUrl),
      href: `/shows/${encodeURIComponent(show.showId)}`,
      nextEpisode: progress.next
        ? {
            seasonNumber: progress.next.seasonNumber,
            episodeNumber: progress.next.episodeNumber,
            title: blankToNull(progress.next.title),
            href: `/shows/${encodeURIComponent(show.showId)}/seasons/${encodeURIComponent(progress.next.seasonId)}`,
          }
        : null,
      seasonProgress: {
        seasonNumber: focus.seasonNumber,
        watched: seasonEpisodes.filter((episode) => episode.status === "watched").length,
        total: seasonEpisodes.length,
      },
      lastWatchedAt: lastWatchedInstant(progress.lastWatched, show.episodes),
    });
  }

  return items
    .sort(
      (left, right) => right.lastWatchedAt.localeCompare(left.lastWatchedAt) || left.showId.localeCompare(right.showId),
    )
    .slice(0, CONTINUE_WATCHING_LIMIT);
}

/** 按固定页大小翻页，避免 PostgREST 默认行数上限把单集截断。 */
async function eachPage<T>(
  label: string,
  load: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await load(page * PAGE_SIZE);
    if (error) {
      console.error(`Failed to fetch continue watching ${label}:`, error);
      throw new MediaRepositoryError(`fetch continue watching ${label}`, error);
    }
    const pageRows = data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) return rows;
  }
  throw new MediaRepositoryError(`fetch continue watching ${label} page limit`);
}

/** 读取状态为在看的电视节目。电影的观看状态不参与。 */
async function fetchWatchingShows(): Promise<ShowRow[]> {
  const db = getSupabasePublicServer();
  return eachPage("shows", (offset) =>
    db
      .from("v_all_media")
      .select("id,title,cover_url")
      .eq("type", "tv_show")
      .eq("status", "watching")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1),
  );
}

/** 一次读出这些节目的全部单集，供内存里套用下一集规则。 */
async function fetchEpisodes(showIds: readonly string[]): Promise<EpisodeProgress[]> {
  const db = getSupabasePublicServer();
  const episodes: EpisodeProgress[] = [];

  for (let index = 0; index < showIds.length; index += SHOW_ID_CHUNK) {
    const ids = showIds.slice(index, index + SHOW_ID_CHUNK);
    const rows = await eachPage("episodes", (offset) =>
      db
        .from("tv_episodes")
        .select(EPISODE_COLUMNS)
        .in("season.series_id", [...ids])
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1),
    );

    for (const row of rows as EpisodeRow[]) {
      const season = firstRelated(row.season);
      if (!season) continue;
      const media = firstRelated(row.media);
      episodes.push({
        showId: season.series_id,
        seasonId: season.id,
        seasonNumber: Number(season.season_number),
        episodeNumber: Number(row.episode_number),
        title: media?.title ?? null,
        releaseDate: media?.release_date ?? null,
        status: firstRelated(media?.tracking)?.status ?? null,
      });
    }
  }

  return episodes;
}

/** 把节目卡片和单集进度按节目 ID 拼在一起。没有单集的节目保留为空列表，随后会被进度规则滤掉。 */
function groupShows(shows: readonly ShowRow[], episodes: readonly EpisodeProgress[]): ContinueWatchingShow[] {
  const episodesByShow = new Map<string, EpisodeProgress[]>();
  for (const episode of episodes) {
    const list = episodesByShow.get(episode.showId) ?? [];
    list.push(episode);
    episodesByShow.set(episode.showId, list);
  }

  return shows.map((show) => ({
    showId: show.id,
    title: show.title ?? "",
    coverUrl: show.cover_url,
    episodes: episodesByShow.get(show.id) ?? [],
  }));
}

/**
 * 首页「继续看」。
 * 只含 v_all_media 状态为 watching 的电视节目，按进度前缘的上映时间从新到旧，最多 8 条。
 * 访客和站长走同一个公开读取客户端；tracking 与媒体表对 anon、authenticated 都开放 SELECT。
 * 首页用 unstable_cache 包住这个函数。这里不能读 cookies()、headers() 或当前用户，否则缓存会在运行时失败。
 * 没有在看的节目时返回空数组。查询失败抛出 MediaRepositoryError。
 */
export async function getContinueWatching(): Promise<ContinueWatchingItem[]> {
  return withRetry(async () => {
    const shows = await fetchWatchingShows();
    if (shows.length === 0) return [];
    const episodes = await fetchEpisodes(shows.map((show) => show.id));
    return assembleContinueWatching(groupShows(shows, episodes));
  });
}

/** 首页「在听」最多返回的专辑数。 */
export const CONTINUE_LISTENING_LIMIT = 8;

/**
 * 首页「在听」的一张专辑。
 * 规则由 v_continue_listening 计算：至少一首曲目 watched，但并非全部曲目都 watched。
 * 仅在 album 类型启用（公开路由开放）时查询与展示，避免链到未启用的 /albums/…。
 */
export type ContinueListeningItem = {
  albumId: string;
  title: string;
  posterPath: string | null;
  href: string;
  trackProgress: {
    watched: number;
    total: number;
  };
  /**
   * 排序用：已听曲目中最晚的上映日（UTC 零点）。
   * tracking 没有收听时间戳，这不是真实“最近听过”时间。
   */
  latestWatchedTrackReleaseAt: string;
};

type ContinueListeningRow = {
  album_id: string;
  title: string | null;
  cover_url: string | null;
  release_date: string | null;
  track_total: number | string;
  track_watched: number | string;
  latest_watched_track_release_date: string | null;
};

/** 把在听视图行收成首页条目；按已听曲目上映日从新到旧排序（非收听时间）。 */
export function assembleContinueListening(rows: readonly ContinueListeningRow[]): ContinueListeningItem[] {
  const albumRoute = MEDIA_TYPE_DEFINITIONS.album.route;
  return rows
    .map((row) => {
      const albumId = row.album_id;
      const watched = Number(row.track_watched) || 0;
      const total = Number(row.track_total) || 0;
      return {
        albumId,
        title: (row.title ?? "").trim(),
        posterPath: posterPathFromCover(row.cover_url),
        href: `/${albumRoute}/${encodeURIComponent(albumId)}`,
        trackProgress: { watched, total },
        latestWatchedTrackReleaseAt:
          releaseDateToUtc(row.latest_watched_track_release_date) ??
          releaseDateToUtc(row.release_date) ??
          MISSING_RELEASE_INSTANT,
      };
    })
    .sort(
      (left, right) =>
        right.latestWatchedTrackReleaseAt.localeCompare(left.latestWatchedTrackReleaseAt) ||
        left.albumId.localeCompare(right.albumId),
    )
    .slice(0, CONTINUE_LISTENING_LIMIT);
}

async function fetchListeningAlbums(): Promise<ContinueListeningRow[]> {
  const db = getSupabasePublicServer();
  return eachPage("listening", (offset) =>
    db
      .from("v_continue_listening")
      .select("album_id,title,cover_url,release_date,track_total,track_watched,latest_watched_track_release_date")
      .order("album_id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1),
  );
}

/**
 * 首页「在听」：部分听过但未听完的专辑，最多 8 条。
 * album 未在 media-types 中启用时直接返回空数组，不查询、不渲染，避免 /albums 404。
 */
export async function getContinueListening(): Promise<ContinueListeningItem[]> {
  if (!MEDIA_TYPE_DEFINITIONS.album.enabled) return [];
  return withRetry(async () => {
    const rows = await fetchListeningAlbums();
    return assembleContinueListening(rows);
  });
}

/** 首页「在读」最多返回的图书数。 */
export const CURRENTLY_READING_LIMIT = 8;

/**
 * 首页「在读」的一本图书：tracking.status = in_progress。
 * 不跟踪页数进度；排序用出版日（release_date），不是真实阅读时间。
 */
export type CurrentlyReadingItem = {
  bookId: string;
  title: string;
  posterPath: string | null;
  href: string;
  /** 排序用出版日（UTC 零点）；无出版日时为 Unix 纪元。 */
  releaseAt: string;
  authors: string[];
};

type CurrentlyReadingRow = {
  id: string;
  title: string | null;
  cover_url: string | null;
  release_date: string | null;
  authors: string[] | null;
};

/** 把在读查询行收成首页条目；按出版日从新到旧。 */
export function assembleCurrentlyReading(rows: readonly CurrentlyReadingRow[]): CurrentlyReadingItem[] {
  const bookRoute = MEDIA_TYPE_DEFINITIONS.book.route;
  return rows
    .map((row) => ({
      bookId: row.id,
      title: (row.title ?? "").trim(),
      posterPath: posterPathFromCover(row.cover_url),
      href: `/${bookRoute}/${encodeURIComponent(row.id)}`,
      releaseAt: releaseDateToUtc(row.release_date) ?? MISSING_RELEASE_INSTANT,
      authors: [...(row.authors ?? [])].filter((name) => name.trim().length > 0),
    }))
    .sort(
      (left, right) =>
        right.releaseAt.localeCompare(left.releaseAt) || left.bookId.localeCompare(right.bookId),
    )
    .slice(0, CURRENTLY_READING_LIMIT);
}

type CurrentlyReadingViewRow = {
  id: string;
  title: string | null;
  cover_url: string | null;
  sort_date: string | null;
  authors: string[] | null;
};

async function fetchCurrentlyReadingRows(): Promise<CurrentlyReadingRow[]> {
  const db = getSupabasePublicServer();
  const rows = await eachPage<CurrentlyReadingViewRow>("currently-reading", (offset) =>
    db
      .from("v_all_media")
      .select("id,title,cover_url,sort_date,authors")
      .eq("type", "book")
      .eq("status", "in_progress")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1),
  );
  return rows.map((row) => ({
    id: String(row.id),
    title: row.title,
    cover_url: row.cover_url,
    release_date: row.sort_date,
    authors: row.authors,
  }));
}

/**
 * 首页「在读」：status=in_progress 的图书，最多 8 条。
 * book 未启用时直接返回空数组，避免链到未开放的 /books/…。
 * 供前端首页行单独调用；不强制并入 getHomeContinue，以免破坏现有在看／在听形状。
 */
export async function getCurrentlyReading(): Promise<CurrentlyReadingItem[]> {
  if (!MEDIA_TYPE_DEFINITIONS.book.enabled) return [];
  return withRetry(async () => {
    const rows = await fetchCurrentlyReadingRows();
    return assembleCurrentlyReading(rows);
  });
}

/** 首页继续区块：在看（影视）与在听（音乐）分开返回，便于渲染两行。 */
export type HomeContinueData = {
  watching: ContinueWatchingItem[];
  listening: ContinueListeningItem[];
  /** 在读图书；可选字段，旧调用方忽略即可。 */
  reading?: CurrentlyReadingItem[];
};

/**
 * 并行读取在看、在听与在读。任一侧失败则整次失败，由页面 Promise.allSettled 降级。
 * 形状相对旧版 getContinueWatching() 的数组有破坏性变更；调用方应改读 watching／listening／reading。
 */
export async function getHomeContinue(): Promise<HomeContinueData> {
  const [watching, listening, reading] = await Promise.all([
    getContinueWatching(),
    getContinueListening(),
    getCurrentlyReading(),
  ]);
  return { watching, listening, reading };
}
