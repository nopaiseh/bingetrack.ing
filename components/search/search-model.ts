import { WATCH_STATUSES } from "@/components/watch-status";
import { PAGE_SIZE, type SearchFilters } from "@/lib/api/search-state";
import { MEDIA_TYPE_DEFINITIONS, isSearchDbMediaType, type SearchDbMediaType } from "@/lib/media-types";

/**
 * 分类筛选项顺序与文案（仅搜索面板／已选条件条）。
 * value 与 URL `type=` 及 MEDIA_TYPE_DEFINITIONS 对齐；album 显示为「专辑」以区别于顶栏等处的「音乐」。
 * 集合须与 SEARCH_DB_TYPES 一致（顺序可不同）；见 tests/search-model.test.ts。
 * 人物角色不在分类行，见 CREDIT_ROLE_OPTIONS。
 */
export const TYPE_FILTER_ORDER = [
  "movie",
  "tv_show",
  "album",
  "music",
  "book",
] as const satisfies readonly SearchDbMediaType[];

export const TYPE_OPTIONS = [
  ...TYPE_FILTER_ORDER.map((value) => ({
    value,
    label: value === "album" ? "专辑" : MEDIA_TYPE_DEFINITIONS[value].label,
  })),
  { value: "series", label: "系列" },
];

/**
 * 人物角色筛选项：顺序固定，作者放最后；value 与 URL／API `creditRole=` 对齐。
 * 「全部」由 FilterOptionRow 渲染，不在此列表。
 */
export const CREDIT_ROLE_OPTIONS = [
  { value: "director", label: "导演" },
  { value: "actor", label: "演员" },
  { value: "artist", label: "歌手" },
  { value: "lyricist", label: "作词" },
  { value: "composer", label: "作曲" },
  { value: "author", label: "作者" },
] as const;

export const STATUS_OPTIONS = [
  { value: "want_to_watch", label: WATCH_STATUSES.want_to_watch.label },
  { value: "watching", label: WATCH_STATUSES.watching.label },
  { value: "in_progress", label: WATCH_STATUSES.in_progress.label },
  { value: "watched", label: WATCH_STATUSES.watched.label },
  { value: "upcoming", label: "即将上映" },
];

/** 所选分类是否全是音乐类型（专辑／单曲，可混选）。 */
function isMusicOnlyFilter(selectedTypes: readonly string[]): boolean {
  const mediaTypes = selectedTypes.filter((type) => isSearchDbMediaType(type));
  return mediaTypes.length > 0 && mediaTypes.every((type) => type === "music" || type === "album");
}

/** 仅筛选专辑／单曲时，状态用「已听／想听／在听」；与媒体全景看板文案一致。 */
export function statusFilterLabel(value: string, selectedTypes: readonly string[] = []): string {
  if (isMusicOnlyFilter(selectedTypes)) {
    if (value === "watched") return "已听";
    if (value === "want_to_watch") return "想听";
    if (value === "watching") return "在听";
  }
  return optionLabel(STATUS_OPTIONS, value);
}

/** 状态筛选项：音乐场景下替换想看／已看／在看文案，其余保持影视／图书默认。 */
export function statusFilterOptions(selectedTypes: readonly string[] = []) {
  return STATUS_OPTIONS.map((option) => ({
    ...option,
    label: statusFilterLabel(option.value, selectedTypes),
  }));
}

export const PRIMARY_CATEGORIES = [
  { id: "type", label: "分类", options: TYPE_OPTIONS, multiSelect: true },
  {
    id: "creditRole",
    label: "人物",
    options: CREDIT_ROLE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    multiSelect: true,
  },
  { id: "status", label: "状态", options: STATUS_OPTIONS, multiSelect: true },
];

export const SORT_OPTIONS = [
  { id: "date", label: "日期" },
  { id: "rating", label: "评分" },
];

export const EMPTY_FILTERS = Object.freeze({
  type: Object.freeze([] as const),
  creditRole: Object.freeze([] as const),
  status: Object.freeze([] as const),
  genre: Object.freeze([] as const),
  region: Object.freeze([] as const),
  language: Object.freeze([] as const),
  year: Object.freeze([] as const),
  sort: Object.freeze(["date_desc"] as const),
} as const);

/** 按规范值查找选项文案，未知值原样显示。 */
export function optionLabel(options: { value: string; label: string }[], value: string) {
  return options.find(/* 查找与规范值对应的选项。 */ (option) => option.value === value)?.label ?? value;
}

/** 统计偏离默认值的筛选项，供手机端「筛选 (n)」展示。排序只在离开默认日期降序时计入。 */
export function countActiveFilters(filters: SearchFilters) {
  const listed = ["type", "creditRole", "status", "genre", "region", "language"].reduce(
    (sum, key) => sum + (filters[key]?.length ?? 0),
    0,
  );
  const year = filters.year?.some(Boolean) ? 1 : 0;
  const sort = filters.sort?.[0] && filters.sort[0] !== "date_desc" ? 1 : 0;
  return listed + year + sort;
}

/** 当前排序在结果上方的一句说明。 */
export function sortCaption(sort: string) {
  switch (sort) {
    case "date_asc":
      return "按上映日期，旧到新";
    case "rating_desc":
      return "按评分，从高到低";
    case "rating_asc":
      return "按评分，从低到高";
    default:
      return "按上映日期，新到旧";
  }
}

/** 本页在全部结果中的区间，例如 1–9 / 9。没有结果时不显示。 */
export function resultRange(page: number, total: number) {
  if (total <= 0) return null;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  return `${start}–${end} / ${total}`;
}

/** 有关键词且已经确定是 0 条时，标题改成「没有找到」。加载中仍用搜索结果，避免先闪空状态。 */
export function resultsHeading(query: string, total: number, pending: boolean) {
  if (!query) return "搜索结果";
  if (!pending && total === 0) return `没有找到“${query}”`;
  return `“${query}”的搜索结果`;
}

/**
 * 搜索结果数量文案：仅筛单曲用「首」，仅筛图书用「本」，
 * 影视／专辑／未选分类／混选仍用「部作品」。
 */
export function resultsCountLabel(total: number, selectedTypes: readonly string[] = []): string {
  const mediaTypes = selectedTypes.filter((type) => isSearchDbMediaType(type));
  if (mediaTypes.length === 1 && mediaTypes[0] === "music") return `找到 ${total} 首`;
  if (mediaTypes.length === 1 && mediaTypes[0] === "book") return `找到 ${total} 本`;
  return `找到 ${total} 部作品`;
}
