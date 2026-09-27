import type { UpcomingRelease } from "@/lib/types";

const DAY_MS = 86_400_000;

/** 以浏览者本地时区生成 YYYY-MM-DD 日期键，与数据库中不带时区的上映日期直接比较。 */
export function localDateKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 计算两个 YYYY-MM-DD 日期相差的整天数，按 UTC 零点解析以避开夏令时偏差。 */
export function daysUntil(releaseDate: string, today: string): number {
  return Math.round((Date.parse(`${releaseDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

/** 过滤掉今天之前的条目，每个分组只保留最早的一条，再按上映日期升序取前若干条。 */
export function pickUpcoming(items: UpcomingRelease[], today: string, limit = 4): UpcomingRelease[] {
  const seen = new Set<string>();
  return items
    .filter(/* 只保留今天及以后上映的条目。 */ (item) => item.releaseDate >= today)
    .sort(/* 按上映日期升序，同日按 ID 保持稳定顺序。 */ (left, right) =>
      left.releaseDate.localeCompare(right.releaseDate) || left.id.localeCompare(right.id),
    )
    .filter(/* 同一分组已出现过时跳过，避免一部剧的多集占满展台。 */ (item) => {
      if (seen.has(item.groupId)) return false;
      seen.add(item.groupId);
      return true;
    })
    .slice(0, limit);
}
