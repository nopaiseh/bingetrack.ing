import { WATCH_STATUSES } from "@/components/watch-status";
import { PAGE_SIZE, type SearchFilters } from "@/lib/api/search-state";
import { CATALOG_DB_TYPES, MEDIA_TYPE_DEFINITIONS } from "@/lib/media-types";

export const TYPE_OPTIONS = [
  ...CATALOG_DB_TYPES.map((value) => ({ value, label: MEDIA_TYPE_DEFINITIONS[value].label })),
  { value: "series", label: "系列" },
  { value: "director", label: "导演" },
  { value: "actor", label: "演员" },
];

export const STATUS_OPTIONS = [
  { value: "want_to_watch", label: WATCH_STATUSES.want_to_watch.label },
  { value: "watching", label: WATCH_STATUSES.watching.label },
  { value: "in_progress", label: WATCH_STATUSES.in_progress.label },
  { value: "watched", label: WATCH_STATUSES.watched.label },
  { value: "upcoming", label: "即将上映" },
];

export const PRIMARY_CATEGORIES = [
  { id: "type", label: "分类", options: TYPE_OPTIONS, multiSelect: true },
  { id: "status", label: "状态", options: STATUS_OPTIONS, multiSelect: true },
];

export const SORT_OPTIONS = [
  { id: "date", label: "日期" },
  { id: "rating", label: "评分" },
];

export const EMPTY_FILTERS = Object.freeze({
  type: Object.freeze([] as const),
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
  const listed = ["type", "status", "genre", "region", "language"].reduce(
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
