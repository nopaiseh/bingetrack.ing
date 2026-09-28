import type { WatchStatus } from "@/lib/admin/series-structure";

export type QuickAddKind = "episode" | "season";
export type CurrentItem = { type: "tv_show" | "tv_season" | "tv_episode"; id: string };

export const statusLabels: Record<WatchStatus, string> = { watched: "看过", watching: "在看", want_to_watch: "没看过" };

/** 编辑链接带上类型，侧栏据此把季与单集归入「电视节目」。 */
export function mediaHref(type: CurrentItem["type"], id: string) {
  return `/manage/media/${id}?type=${type}`;
}

/** 四位数以上的季集数加千位分隔，与列表口径一致。 */
export function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

/** 两位数以内补零对齐，更长的集号原样显示。 */
export function episodeLabel(number: number) {
  return number < 100 ? String(number).padStart(2, "0") : String(number);
}
