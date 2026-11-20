import type { WatchStatus } from "@/lib/admin/series-structure";

export type AlbumCurrentItem = { type: "album" | "music"; id: string };

export const listenStatusLabels: Record<WatchStatus, string> = {
  watched: "听过",
  watching: "在听",
  want_to_watch: "没听过",
};

/** 编辑链接带上类型，侧栏据此把曲目归入「音乐」。 */
export function albumMediaHref(type: AlbumCurrentItem["type"], id: string) {
  return `/manage/media/${id}?type=${type}`;
}

export { formatCount, episodeLabel as trackLabel } from "../series/shared";

/** 将秒数格式化为 m:ss；空值显示破折号。 */
export function formatSeconds(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
