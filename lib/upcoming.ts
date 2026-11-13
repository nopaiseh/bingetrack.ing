import type { UpcomingRelease } from "@/lib/types";

const DAY_MS = 86_400_000;
const GMT8_OFFSET_MS = 8 * 3_600_000;

/** 以 GMT+8 生成 YYYY-MM-DD 日期键，与数据库中不带时区的上映日期直接比较；服务端与任意时区的浏览器结果一致。 */
export function gmt8DateKey(date: Date = new Date()): string {
  return new Date(date.getTime() + GMT8_OFFSET_MS).toISOString().slice(0, 10);
}

/** 上映日期是今天或更晚时视为即将上映。只认 YYYY-MM-DD，年份或区间不当成未来日期。 */
export function isUpcomingDate(date: string | null | undefined, today = gmt8DateKey()): boolean {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return false;
  return date.slice(0, 10) >= today;
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
