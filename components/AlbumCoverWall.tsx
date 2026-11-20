import AlbumCoverCard from "@/components/AlbumCoverCard";
import type { MediaCard } from "@/lib/types";

/** 专辑列表：紧凑方形封面墙；无条目时显示空状态。 */
export default function AlbumCoverWall({ items }: { items: readonly MediaCard[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] px-6 py-16 text-center">
        <p className="text-sm text-fg-muted">还没有专辑。</p>
      </div>
    );
  }

  return (
    <ul
      className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-6 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
      aria-label="专辑封面墙"
    >
      {items.map((item, index) => (
        <li key={item.id} className="min-w-0">
          <AlbumCoverCard item={item} eager={index < 6} />
        </li>
      ))}
    </ul>
  );
}
