import type { MediaCard } from "@/lib/types";
import MediaRatingBadge from "./MediaRatingBadge";

/** 类型优先，再补一个语言，卡片上最多三个标签。 */
export function mediaCardTags(item: Pick<MediaCard, "genres" | "languages">): string[] {
  return [...(item.genres ?? []).slice(0, 3), ...(item.languages ?? []).slice(0, 1)].slice(0, 3);
}

/** 电影取上映年；剧集保留跨年区间，并把连字符收成短横。 */
function mediaCardYear(item: MediaCard, type: "movies" | "shows"): string {
  if (type === "shows") {
    return String(item.release_year || (item.date ? item.date.substring(0, 4) : "未知")).replace(/\s*-\s*/g, "–");
  }
  return item.date ? item.date.substring(0, 4) : "未知";
}

/** 卡片标题、年份、评分和标签。标题固定两行高，短标题也不会把同一行的卡片挤矮。 */
export default function MediaCardBody({ item, type }: { item: MediaCard; type: "movies" | "shows" }) {
  const tags = mediaCardTags(item);

  return (
    <div className="flex min-w-0 grow flex-col space-y-1.5 px-3 py-2.5">
      <h3
        className="font-serif-movie line-clamp-2 min-h-10 text-sm font-bold leading-5 text-white transition-colors duration-300 group-hover:text-[var(--accent-hover)]"
        title={item.title}
      >
        {item.title}
      </h3>

      <div className="flex min-w-0 items-center justify-between gap-1.5 text-xs">
        <span className="shrink-0 whitespace-nowrap font-medium text-fg-secondary">
          {mediaCardYear(item, type)}
        </span>
        <MediaRatingBadge rating={item.rating} size="sm" showTier={item.rating != null} />
      </div>

      <div className="mt-1.5 flex min-h-6 w-full items-center gap-1.5 overflow-hidden">
        {tags.map(/* 类型和语言用同一套 12px 徽标，过长时在卡片内截断。 */ (tag, index) => (
          <span
            key={`${tag}-${index}`}
            title={tag}
            className="inline-flex min-h-5 shrink items-center truncate rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-xs font-medium tracking-wide text-fg-secondary transition-all duration-300 group-hover:border-[var(--accent-border)] group-hover:bg-[var(--accent-soft)] group-hover:text-fg"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
