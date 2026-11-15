import type { UpcomingRelease } from "@/lib/types";

const DAY_MS = 86_400_000;

/** 首页每次渲染都会取新加坡当天。格式化器创建一次，避免重复构造。 */
const sgtDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Singapore",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Asia/Singapore 的日历日，YYYY-MM-DD。新加坡全年 UTC+8，没有夏令时。 */
export function sgtDateKey(date: Date = new Date()): string {
  const parts = sgtDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

/** 上映日期是今天或更晚时视为即将上映。只认 YYYY-MM-DD，年份或区间不当成未来日期。 */
export function isUpcomingDate(date: string | null | undefined, today = sgtDateKey()): boolean {
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
    .sort(
      /* 按上映日期升序，同日按 ID 保持稳定顺序。 */ (left, right) =>
        left.releaseDate.localeCompare(right.releaseDate) || left.id.localeCompare(right.id),
    )
    .filter(
      /* 同一分组已出现过时跳过，避免一部剧的多集占满展台。 */ (item) => {
        if (seen.has(item.groupId)) return false;
        seen.add(item.groupId);
        return true;
      },
    )
    .slice(0, limit);
}
