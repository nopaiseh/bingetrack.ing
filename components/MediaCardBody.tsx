import type { MediaCard } from "@/lib/types";
import MediaRatingBadge from "./MediaRatingBadge";

/** 类型优先，再补一个语言，卡片上最多三个标签。 */
export function mediaCardTags(item: Pick<MediaCard, "genres" | "languages">): string[] {
  return [...(item.genres ?? []).slice(0, 3), ...(item.languages ?? []).slice(0, 1)].slice(0, 3);
}

/** 图书作者名按 credit_order 拼接；空则不显示作者行。 */
export function mediaCardAuthorsLine(authors: readonly string[] | null | undefined): string | null {
  const names = (authors ?? []).map((name) => name.trim()).filter(Boolean);
  return names.length > 0 ? names.join("、") : null;
}

/** 电影／图书取上映年；剧集保留跨年区间，并把连字符收成短横。 */
function mediaCardYear(item: MediaCard, dbType: "movie" | "tv_show" | "book"): string {
  if (dbType === "tv_show") {
    return String(item.release_year || (item.date ? item.date.substring(0, 4) : "未知")).replace(/\s*-\s*/g, "–");
  }
  return item.date ? item.date.substring(0, 4) : "未知";
}

/** 卡片标题、年份、评分和标签。标题固定两行高，短标题也不会把同一行的卡片挤矮。图书在标题下显示作者行。 */
export default function MediaCardBody({
  item,
  dbType,
  headingLevel = 3,
}: {
  item: MediaCard;
  /** 年份口径：剧集用跨年区间；图书另显示 authors。 */
  dbType: "movie" | "tv_show" | "book";
  /** 搜索页在 h1 下用 h2；目录行在行标题 h2 下保持 h3。 */
  headingLevel?: 2 | 3;
}) {
  const tags = mediaCardTags(item);
  const Title = headingLevel === 2 ? "h2" : "h3";
  const authorsLine = dbType === "book" ? mediaCardAuthorsLine(item.authors) : null;

  return (
    <div className="flex min-w-0 grow flex-col space-y-1.5 px-3 py-2.5">
      <Title
        className="font-display line-clamp-2 min-h-10 text-sm font-bold leading-5 text-white transition-colors duration-300 group-hover:text-[var(--accent-hover)]"
        title={item.title}
      >
        {item.title}
      </Title>
      {authorsLine ? (
        <p className="truncate text-xs text-fg-muted" title={authorsLine}>
          {authorsLine}
        </p>
      ) : null}

      <div className="flex min-w-0 items-center justify-between gap-1.5 text-xs">
        <span className="shrink-0 whitespace-nowrap font-medium text-fg-secondary">{mediaCardYear(item, dbType)}</span>
        <MediaRatingBadge rating={item.rating} size="sm" showTier={item.rating != null} />
      </div>

      <div className="mt-1.5 flex min-h-6 w-full items-center gap-1.5 overflow-hidden">
        {tags.map(
          /* 类型和语言用同一套 12px 徽标，过长时在卡片内截断。 */ (tag, index) => (
            <span
              key={`${tag}-${index}`}
              title={tag}
              className="inline-flex min-h-5 shrink items-center truncate rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-xs font-medium tracking-wide text-fg-secondary transition-all duration-300 group-hover:border-[var(--accent-border)] group-hover:bg-[var(--accent-soft)] group-hover:text-fg"
            >
              {tag}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
