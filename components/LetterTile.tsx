import { titleAccentIndex, titleInitial } from "@/lib/title-accent";

/**
 * 没有图片时的字块。字形用 CSS 画出来，不放进文本节点。
 * 与相邻可见标题配套时设 decorative（默认），aria-hidden，避免与标题抢无障碍名称；
 * 封面单独出现、没有可见标题时设 decorative={false}，用 aria-label 提供名称。
 */
export default function LetterTile({
  title,
  avatar = false,
  decorative = true,
  className = "",
}: {
  title: string;
  avatar?: boolean;
  /** 与可见标题配套时为 true；封面单独出现时为 false。 */
  decorative?: boolean;
  className?: string;
}) {
  const label = title.trim() || "未命名";
  return (
    <div
      className={`letter-tile flex items-center justify-center ${avatar ? "letter-tile-avatar size-10 shrink-0 rounded-full" : "h-full w-full"} ${className}`}
      data-accent={titleAccentIndex(title)}
      data-initial={titleInitial(title)}
      {...(decorative ? { "aria-hidden": true as const } : { role: "img" as const, "aria-label": label })}
    />
  );
}
