import { titleAccentIndex, titleInitial } from "@/lib/title-accent";

/**
 * 没有图片时的字块。字形用 CSS 画出来，不放进文本节点，
 * 这样它不会进入链接的可见文本，也不会和名字抢无障碍名称。
 */
export default function LetterTile({
  title,
  avatar = false,
  className = "",
}: {
  title: string;
  avatar?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`letter-tile flex items-center justify-center ${avatar ? "letter-tile-avatar size-10 shrink-0 rounded-full" : "h-full w-full"} ${className}`}
      data-accent={titleAccentIndex(title)}
      data-initial={titleInitial(title)}
      aria-hidden="true"
    />
  );
}
