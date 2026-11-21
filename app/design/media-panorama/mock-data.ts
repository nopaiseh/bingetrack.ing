/**
 * 设计原型 mock：对齐已定后端 `release_year_stats` 扩展形状（另开 PR，本分支不实现）。
 *
 * 专辑列：total_albums、listened_albums（已听）
 * 图书列：total_books、read_books（已读）、reading_books（在读）
 * 年份：专辑发行日／书出版日；「All Time」汇总
 * 完成进度：仍只用影视片长，音书不并入
 *
 * 图书全 0 用于验收空态。不连数据库。
 */

/** 与即将扩展的 Summary／release_year_stats 行对齐的模拟字段。 */
export type ReleaseYearStatsRow = {
  release_year: string;
  // 既有影视（节选，够原型用）
  watched_movies: number;
  unwatched_movies: number;
  watched_series: number;
  watching_series: number;
  unwatched_series: number;
  watched_seasons: number;
  watching_seasons: number;
  unwatched_seasons: number;
  watched_series_episodes: number;
  unwatched_episodes: number;
  total_series_episodes: number;
  total_watched_runtime: number;
  total_runtime: number;
  // 已定新增
  total_albums: number;
  listened_albums: number;
  total_books: number;
  read_books: number;
  reading_books: number;
};

export const MOCK_YEAR = "全时段档案";

/** 全时段一行；字段名即后端将提供的列。 */
export const MOCK_SUMMARY: ReleaseYearStatsRow = {
  release_year: "All Time",
  watched_movies: 60,
  unwatched_movies: 7,
  watched_series: 4,
  watching_series: 3,
  unwatched_series: 5,
  watched_seasons: 18,
  watching_seasons: 5,
  unwatched_seasons: 7,
  watched_series_episodes: 132,
  unwatched_episodes: 113,
  total_series_episodes: 245,
  total_watched_runtime: 66,
  total_runtime: 100,
  total_albums: 28,
  listened_albums: 14,
  total_books: 0,
  read_books: 0,
  reading_books: 0,
};

export type PanoramaTypeStats = {
  id: "movie" | "tv_show" | "album" | "book";
  label: string;
  unit: "部" | "张" | "本";
  icon: string;
  total: number;
  /** 看板内进度条分子（音书用已听／已读；不参与标题「完成进度」） */
  done: number;
  doneTotal: number;
  /** 无则不画看板内进度条（图书空态可省略百分比文案） */
  progressLabel: string | null;
  statuses: Array<{
    id: string;
    label: string;
    icon: string;
    toneClass: string;
    count: number;
    details?: string;
  }>;
};

function buildTypes(row: ReleaseYearStatsRow): PanoramaTypeStats[] {
  const totalMovies = row.watched_movies + row.unwatched_movies;
  const totalSeries = row.watched_series + row.watching_series + row.unwatched_series;

  return [
    {
      id: "movie",
      label: "电影",
      unit: "部",
      icon: "i-material-symbols-movie-rounded",
      total: totalMovies,
      done: row.watched_movies,
      doneTotal: totalMovies,
      progressLabel: "观影完成度",
      statuses: [
        {
          id: "watched",
          label: "已看",
          icon: "i-material-symbols-check-circle-outline-rounded",
          toneClass: "text-[var(--ok)]",
          count: row.watched_movies,
        },
        {
          id: "want",
          label: "想看",
          icon: "i-material-symbols-bookmark-outline-rounded",
          toneClass: "text-[var(--accent-hover)]",
          count: row.unwatched_movies,
        },
      ],
    },
    {
      id: "tv_show",
      label: "电视节目",
      unit: "部",
      icon: "i-material-symbols-tv-rounded",
      total: totalSeries,
      done: row.watched_series_episodes,
      doneTotal: row.total_series_episodes,
      progressLabel: "单集观看进度",
      statuses: [
        {
          id: "watched",
          label: "已看",
          icon: "i-material-symbols-check-circle-outline-rounded",
          toneClass: "text-[var(--ok)]",
          count: row.watched_series,
          details: `${row.watched_seasons}季 · ${row.watched_series_episodes}集`,
        },
        {
          id: "watching",
          label: "在看",
          icon: "i-material-symbols-play-circle-outline-rounded",
          toneClass: "text-[var(--warn)]",
          count: row.watching_series,
          details: `${row.watching_seasons}季`,
        },
        {
          id: "want",
          label: "想看",
          icon: "i-material-symbols-bookmark-outline-rounded",
          toneClass: "text-[var(--accent-hover)]",
          count: row.unwatched_series,
          details: `${row.unwatched_seasons}季 · ${row.unwatched_episodes}集`,
        },
      ],
    },
    {
      id: "album",
      label: "音乐",
      unit: "张",
      icon: "i-material-symbols-album-rounded",
      total: row.total_albums,
      done: row.listened_albums,
      doneTotal: row.total_albums,
      // 看板内可用已听／总数；不并入标题「完成进度」
      progressLabel: "已听占比",
      statuses: [
        {
          id: "listened",
          label: "已听",
          icon: "i-material-symbols-check-circle-outline-rounded",
          toneClass: "text-[var(--ok)]",
          count: row.listened_albums,
        },
      ],
    },
    {
      id: "book",
      label: "图书",
      unit: "本",
      icon: "i-material-symbols-menu-book-rounded",
      total: row.total_books,
      done: row.read_books,
      doneTotal: row.total_books,
      progressLabel: row.total_books > 0 ? "已读占比" : null,
      statuses: [
        {
          id: "read",
          label: "已读",
          icon: "i-material-symbols-check-circle-outline-rounded",
          toneClass: "text-[var(--ok)]",
          count: row.read_books,
        },
        {
          id: "reading",
          label: "在读",
          icon: "i-material-symbols-menu-book-outline-rounded",
          toneClass: "text-[var(--warn)]",
          count: row.reading_books,
        },
      ],
    },
  ];
}

export const MOCK_TYPES = buildTypes(MOCK_SUMMARY);

/** 标题区「完成进度」：仅影视片长，与现网／已定口径一致。 */
export function avRuntimePercent(row: ReleaseYearStatsRow = MOCK_SUMMARY) {
  return percent(row.total_watched_runtime, row.total_runtime);
}

export function percent(done: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(Math.round((done / total) * 100), 0), 100);
}

export function primaryTypes() {
  return MOCK_TYPES.filter((type) => type.id === "movie" || type.id === "tv_show");
}

export function secondaryTypes() {
  return MOCK_TYPES.filter((type) => type.id === "album" || type.id === "book");
}
