/**
 * 设计原型 mock：字段名与列序对齐后端 PR #229
 *（`release_year_stats` 末尾追加的七列）。
 *
 *   total_albums, listened_albums, total_books, read_books,
 *   reading_books, want_albums, want_books
 *
 * 口径（同 #229）：专辑／图书按 media_items.release_date 年份；
 * listened/read = tracking.watched；reading = in_progress；
 * want_* = want_to_watch（**无 tracking 不计想听／想读**）；
 * 单曲不计；时长列仍只含影视。
 *
 * 图书全 0 验收空态。不连数据库。
 */

/** 与 PR #229 `Summary`／视图末尾七列对齐（影视字段仅原型够用子集）。 */
export type ReleaseYearStatsRow = {
  release_year: string;
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
  // —— PR #229 追加（顺序与视图／Summary 一致）——
  total_albums: number;
  listened_albums: number;
  total_books: number;
  read_books: number;
  reading_books: number;
  want_albums: number;
  want_books: number;
};

export const MOCK_YEAR = "全时段档案";

/**
 * 全时段 mock。
 * 专辑：total 28＝listened 14＋want 8＋其余 6（无 tracking／未完成，不算想听）。
 * 图书：全 0 空态。
 */
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
  want_albums: 8,
  want_books: 0,
};

/** PR #229 七列的只读快照，便于方案页／报告引用。 */
export const PR229_ALBUM_BOOK_FIELDS = [
  "total_albums",
  "listened_albums",
  "total_books",
  "read_books",
  "reading_books",
  "want_albums",
  "want_books",
] as const;

export type PanoramaTypeStats = {
  id: "movie" | "tv_show" | "album" | "book";
  label: string;
  unit: "部" | "张" | "本";
  icon: string;
  total: number;
  done: number;
  doneTotal: number;
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
      progressLabel: "已听占比",
      statuses: [
        {
          id: "listened",
          label: "已听",
          icon: "i-material-symbols-check-circle-outline-rounded",
          toneClass: "text-[var(--ok)]",
          count: row.listened_albums,
        },
        {
          id: "want",
          label: "想听",
          icon: "i-material-symbols-bookmark-outline-rounded",
          toneClass: "text-[var(--accent-hover)]",
          count: row.want_albums,
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
        {
          id: "want",
          label: "想读",
          icon: "i-material-symbols-bookmark-outline-rounded",
          toneClass: "text-[var(--accent-hover)]",
          count: row.want_books,
        },
      ],
    },
  ];
}

export const MOCK_TYPES = buildTypes(MOCK_SUMMARY);

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
