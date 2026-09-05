import Image from "next/image";
import Link from "next/link";
import { ImageIcon, Star } from "lucide-react";
import { Media } from "@/lib/types";

function ItemCard({ item, type, eager, highPriority }: { item: Media; type: "movies" | "series"; eager: boolean; highPriority: boolean }) {
  // Combine genres and languages, then limit to a maximum of 4 items
  const tags = [...(item.genres ?? []), ...(item.languages ?? [])].slice(0, 4);

  return (
    <>
      <div className="image-placeholder relative flex aspect-2/3 w-full items-center justify-center overflow-hidden">
        {item.cover_url ? (
          <Image
            src={item.cover_url}
            alt={item.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 639px) 144px, 176px"
            loading={eager ? "eager" : "lazy"}
            fetchPriority={highPriority ? "high" : undefined}
          />
        ) : (
          <ImageIcon className="size-10 text-white/20 drop-shadow-md" aria-hidden="true" />
        )}
      </div>
      
      <div className="flex flex-col space-y-1.5 grow px-3 py-2.5 min-w-0">
        <h3 className="text-sm font-bold text-white truncate drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] group-hover:text-red-300 group-hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.6)] transition-colors duration-300" title={item.title}>
          {item.title}
        </h3>

        <div className="flex justify-between items-center text-xs">
          <span className="text-white/60 font-medium">
            {type === "series"
              ? item.release_year || (item.date ? item.date.substring(0, 4) : "未知")
              : item.date ? item.date.substring(0, 4) : "未知"}
          </span>
          <span className="text-white font-bold flex items-center gap-1 drop-shadow-sm">
            {item.rating ? (
              <>
                <Star className="size-3 fill-current text-yellow-500/90 drop-shadow-[0_0_5px_rgba(234,179,8,0.6)]" aria-hidden="true" />
                {Number(item.rating).toFixed(1)}
              </>
            ) : (
              <span className="text-white/50">未评分</span>
            )}
          </span>
        </div>
        
        <div className="flex flex-row gap-1 mt-1.5 w-full overflow-hidden">
          {tags.map((tag: string, i: number) => (
            <span
              key={`tag-${i}`}
              title={tag} 
              className="surface-muted w-fit min-w-9 shrink truncate rounded-md border border-white/10 px-1.5 py-0.5 text-center text-[9px] font-medium tracking-wide text-white/70 backdrop-blur-md transition-all duration-300 group-hover:border-red-400/30 group-hover:bg-red-500/15 group-hover:text-red-300 group-hover:shadow-[0_4px_10px_rgba(248,113,113,0.2)] sm:text-[10px]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

export default function MediaRow({
  title,
  items,
  viewAllLink,
  type,
  eagerCount = 0,
}: {
  title: string;
  items: Media[];
  viewAllLink?: string;
  type?: "movies" | "series";
  eagerCount?: number;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="relative">
      
      <div className="flex justify-between items-end mb-5 pr-1 border-b border-white/10 pb-3">
        <h2 className="text-xl font-bold tracking-wide text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
          {title}
        </h2>
        {viewAllLink && (
          <Link href={viewAllLink} className="text-sm text-white/60 hover:text-red-400 hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.5)] transition-all duration-300 uppercase tracking-wider">
            查看全部 &rarr;
          </Link>
        )}
      </div>
      
      {/* FIX: Changed py-4 to pt-4 pb-12 and added -mb-8 to offset the extra padding visually so the layout doesn't break */}
      <div className="no-scrollbar -mb-8 flex snap-x snap-mandatory space-x-4 overflow-x-auto px-1 pb-12 pr-5 pt-4 scroll-pl-2">
        {items.map((media: Media, index: number) => {
          const mediaType = type ?? media.type ?? "movies";
          return (
            <Link
              href={`/${mediaType}/${media.id}`}
              key={media.id}
              className="surface-card interactive-media-card group flex w-36 flex-none snap-start cursor-pointer flex-col overflow-hidden rounded-xl sm:w-44"
            >
              <ItemCard item={media} type={mediaType} eager={index < eagerCount} highPriority={eagerCount > 0 && index === 0} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
