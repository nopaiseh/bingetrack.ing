/**
 * 设计原型用的 mock 统计。不连数据库。
 * 图书故意给 0，用来验收空态；音乐给真实形态的三态计数。
 */

export type PanoramaTypeStats = {
  id: "movie" | "tv_show" | "album" | "book";
  label: string;
  unit: "部" | "张" | "本";
  icon: string;
  total: number;
  /** 完成度分子（电影/专辑/图书=已完成；电视=已看集数） */
  done: number;
  /** 完成度分母 */
  doneTotal: number;
  progressLabel: string;
  statuses: Array<{
    id: string;
    label: string;
    icon: string;
    toneClass: string;
    count: number;
    details?: string;
  }>;
};

export const MOCK_YEAR = "全时段档案";

export const MOCK_TYPES: PanoramaTypeStats[] = [
  {
    id: "movie",
    label: "电影",
    unit: "部",
    icon: "i-material-symbols-movie-rounded",
    total: 67,
    done: 60,
    doneTotal: 67,
    progressLabel: "观影完成度",
    statuses: [
      {
        id: "watched",
        label: "已看",
        icon: "i-material-symbols-check-circle-outline-rounded",
        toneClass: "text-[var(--ok)]",
        count: 60,
      },
      {
        id: "want",
        label: "想看",
        icon: "i-material-symbols-bookmark-outline-rounded",
        toneClass: "text-[var(--accent-hover)]",
        count: 7,
      },
    ],
  },
  {
    id: "tv_show",
    label: "电视节目",
    unit: "部",
    icon: "i-material-symbols-tv-rounded",
    total: 12,
    done: 132,
    doneTotal: 245,
    progressLabel: "单集观看进度",
    statuses: [
      {
        id: "watched",
        label: "已看",
        icon: "i-material-symbols-check-circle-outline-rounded",
        toneClass: "text-[var(--ok)]",
        count: 4,
        details: "18季 · 132集",
      },
      {
        id: "watching",
        label: "在看",
        icon: "i-material-symbols-play-circle-outline-rounded",
        toneClass: "text-[var(--warn)]",
        count: 3,
        details: "5季",
      },
      {
        id: "want",
        label: "想看",
        icon: "i-material-symbols-bookmark-outline-rounded",
        toneClass: "text-[var(--accent-hover)]",
        count: 5,
        details: "7季 · 113集",
      },
    ],
  },
  {
    id: "album",
    label: "音乐",
    unit: "张",
    icon: "i-material-symbols-album-rounded",
    total: 28,
    done: 14,
    doneTotal: 28,
    progressLabel: "收听完成度",
    statuses: [
      {
        id: "watched",
        label: "听过",
        icon: "i-material-symbols-check-circle-outline-rounded",
        toneClass: "text-[var(--ok)]",
        count: 14,
        details: "186曲",
      },
      {
        id: "watching",
        label: "在听",
        icon: "i-material-symbols-headphones-rounded",
        toneClass: "text-[var(--warn)]",
        count: 6,
        details: "42曲已听",
      },
      {
        id: "want",
        label: "想听",
        icon: "i-material-symbols-bookmark-outline-rounded",
        toneClass: "text-[var(--accent-hover)]",
        count: 8,
        details: "91曲",
      },
    ],
  },
  {
    id: "book",
    label: "图书",
    unit: "本",
    icon: "i-material-symbols-menu-book-rounded",
    total: 0,
    done: 0,
    doneTotal: 0,
    progressLabel: "阅读完成度",
    statuses: [
      {
        id: "watched",
        label: "读过",
        icon: "i-material-symbols-check-circle-outline-rounded",
        toneClass: "text-[var(--ok)]",
        count: 0,
      },
      {
        id: "in_progress",
        label: "在读",
        icon: "i-material-symbols-menu-book-outline-rounded",
        toneClass: "text-[var(--warn)]",
        count: 0,
      },
      {
        id: "want",
        label: "想读",
        icon: "i-material-symbols-bookmark-outline-rounded",
        toneClass: "text-[var(--accent-hover)]",
        count: 0,
      },
    ],
  },
];

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
