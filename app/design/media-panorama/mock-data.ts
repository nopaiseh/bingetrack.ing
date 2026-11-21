/**
 * 设计原型 mock（方案 A 定稿）。
 *
 * 音乐按歌曲数（凝霜即将新增列，非 #229 专辑列）：
 *   total_tracks / listened_tracks / want_tracks · 单位「首」
 *   （含专辑内曲目与单曲；不再用 total_albums／listened_albums／want_albums）
 *
 * 图书仍用 #229：
 *   total_books / read_books / reading_books / want_books · 单位「本」
 *
 * 完成进度仍只算影视片长。图书全 0 验收空态。不连数据库。
 */

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
  // 音乐：按歌曲（即将新增）
  total_tracks: number;
  listened_tracks: number;
  want_tracks: number;
  // 图书：PR #229
  total_books: number;
  read_books: number;
  reading_books: number;
  want_books: number;
};

export const MOCK_YEAR = "全时段档案";

/**
 * 全时段 mock。
 * 歌曲：total 320＝listened 186＋want 91＋其余 43（无 tracking 等，不算想听）。
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
  total_tracks: 320,
  listened_tracks: 186,
  want_tracks: 91,
  total_books: 0,
  read_books: 0,
  reading_books: 0,
  want_books: 0,
};

/** 方案 A 音乐／图书依赖的计数字段。 */
export const SCHEME_A_MUSIC_BOOK_FIELDS = [
  "total_tracks",
  "listened_tracks",
  "want_tracks",
  "total_books",
  "read_books",
  "reading_books",
  "want_books",
] as const;

export type PanoramaTypeStats = {
  id: "movie" | "tv_show" | "music" | "book";
  label: string;
  unit: "部" | "首" | "本";
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
      id: "music",
      label: "音乐",
      unit: "首",
      icon: "i-material-symbols-music-note-rounded",
      total: row.total_tracks,
      done: row.listened_tracks,
      doneTotal: row.total_tracks,
      progressLabel: "已听占比",
      statuses: [
        {
          id: "listened",
          label: "已听",
          icon: "i-material-symbols-check-circle-outline-rounded",
          toneClass: "text-[var(--ok)]",
          count: row.listened_tracks,
        },
        {
          id: "want",
          label: "想听",
          icon: "i-material-symbols-bookmark-outline-rounded",
          toneClass: "text-[var(--accent-hover)]",
          count: row.want_tracks,
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
  return MOCK_TYPES.filter((type) => type.id === "music" || type.id === "book");
}
