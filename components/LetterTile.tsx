import { titleAccentIndex, titleInitial } from "@/lib/title-accent";

/** 没有海报时的字块：首字加大，颜色由标题决定，色值写在设计令牌里。 */
export default function LetterTile({ title, className = "" }: { title: string; className?: string }) {
  return (
    <div
      className={`letter-tile flex h-full w-full items-center justify-center ${className}`}
      data-accent={titleAccentIndex(title)}
      aria-hidden="true"
    >
      <span>{titleInitial(title)}</span>
    </div>
  );
}
