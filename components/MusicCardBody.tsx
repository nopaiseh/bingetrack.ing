import type { MediaCard } from "@/lib/types";
import MediaRatingBadge from "./MediaRatingBadge";

/** 与 MediaCardBody 类型芯片同一套样式（音乐卡片方案 A）。 */
export const MUSIC_GENRE_CHIP_CLASS =
  "inline-flex min-h-5 shrink items-center truncate rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-xs font-medium tracking-wide text-fg-secondary transition-all duration-300 group-hover:border-[var(--accent-border)] group-hover:bg-[var(--accent-soft)] group-hover:text-fg";

export function musicCardYear(item: Pick<MediaCard, "date" | "release_year">): string {
  if (item.date) return item.date.substring(0, 4);
  if (item.release_year) return String(item.release_year).slice(0, 4);
  return "未知";
}

/** 卡片上最多三个类型名（不掺语言）。 */
export function musicCardGenreTags(item: Pick<MediaCard, "genres">): string[] {
  return [...(item.genres ?? [])].slice(0, 3);
}

/** 搜索页与 /albums 横向行共用的音乐卡正文：标题、艺人、年+评分、类型行。 */
export default function MusicCardBody({
  item,
  headingLevel = 3,
  /** 无艺人时显示「—」（目录行）；搜索页无艺人则不占行。 */
  artistFallback = "omit",
}: {
  item: MediaCard;
  headingLevel?: 2 | 3;
  artistFallback?: "omit" | "dash";
}) {
  const Title = headingLevel === 2 ? "h2" : "h3";
  const title = item.title.trim() || "未命名";
  const artist = (item.artists ?? []).map((name) => name.trim()).find(Boolean) ?? null;
  const tags = musicCardGenreTags(item);

  return (
    <div className="flex min-w-0 grow flex-col space-y-1.5 px-3 py-2.5">
      <Title
        className="font-display line-clamp-2 min-h-10 text-sm font-bold leading-5 text-white transition-colors duration-300 group-hover:text-[var(--accent-hover)]"
        title={title}
      >
        {title}
      </Title>
      {artist ? (
        <p className="truncate text-xs text-fg-muted" title={artist}>
          {artist}
        </p>
      ) : artistFallback === "dash" ? (
        <p className="truncate text-xs text-fg-subtle">—</p>
      ) : null}
      <div className="flex min-w-0 items-center justify-between gap-1.5 text-xs">
        <span className="shrink-0 whitespace-nowrap font-medium text-fg-secondary">{musicCardYear(item)}</span>
        <MediaRatingBadge rating={item.rating} size="sm" showTier={item.rating != null} />
      </div>
      <div
        className="mt-1.5 flex min-h-6 w-full items-center gap-1.5 overflow-hidden"
        aria-label={tags.length ? `类型：${tags.join("、")}` : undefined}
      >
        {tags.map((tag, index) => (
          <span key={`${tag}-${index}`} title={tag} className={MUSIC_GENRE_CHIP_CLASS}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
