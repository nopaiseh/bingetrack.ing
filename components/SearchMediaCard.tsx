import Image from "next/image";
import Link from "next/link";
import { ImageIcon, Star } from "lucide-react";
import type { MediaCard } from "@/lib/types";

export function SearchMediaCardSkeleton() {
  return (
    <div className="surface-card flex flex-col overflow-hidden rounded-xl">
      <div className="surface-muted relative aspect-2/3 w-full overflow-hidden animate-pulse">
        <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/5 to-transparent animate-pulse" />
      </div>
      <div className="flex flex-col space-y-3 px-3 py-2.5">
        <div className="surface-raised h-4 w-3/4 animate-pulse rounded-md" />
        <div className="mt-1 flex items-center justify-between">
          <div className="surface-muted h-3 w-8 animate-pulse rounded-md" />
          <div className="surface-muted h-3 w-10 animate-pulse rounded-md" />
        </div>
        <div className="mt-1 flex gap-1.5">
          <div className="surface-muted h-4 w-10 animate-pulse rounded-md" />
          <div className="surface-muted h-4 w-12 animate-pulse rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function SearchMediaCard({ item, returnHref }: { item: MediaCard; returnHref: string }) {
  return (
    <Link href={`/${item.type}/${item.id}?from=${encodeURIComponent(returnHref)}`} className="surface-card interactive-media-card group flex cursor-pointer flex-col overflow-hidden rounded-xl">
      <div className="image-placeholder relative flex aspect-2/3 w-full items-center justify-center overflow-hidden">
        {item.cover_url ? (
          <Image
            src={item.cover_url}
            alt={item.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 20vw, 16vw"
          />
        ) : (
          <ImageIcon className="size-10 text-white/20 drop-shadow-md" aria-hidden="true" />
        )}
      </div>

      <div className="flex flex-col space-y-1.5 px-3 py-2.5">
        <h3 className="truncate text-sm font-bold text-white transition-colors duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] group-hover:text-red-300 group-hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.6)]" title={item.title}>{item.title}</h3>
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-white/60">{item.date ? item.date.substring(0, 4) : "未知"}</span>
          <span className="flex items-center gap-1 font-bold text-white drop-shadow-sm">
            {item.rating ? <><Star className="size-3 fill-current text-yellow-500/90 drop-shadow-[0_0_5px_rgba(234,179,8,0.6)]" aria-hidden="true" />{Number(item.rating).toFixed(1)}</> : <span className="text-white/50">未评分</span>}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[...(item.genres ?? []).slice(0, 3), ...(item.languages ?? []).slice(0, 2)].map((tag, index) => (
            <span key={`${tag}-${index}`} className="surface-muted inline-flex items-center rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white/70 backdrop-blur-md transition-all duration-300 group-hover:border-red-400/30 group-hover:bg-red-500/15 group-hover:text-red-300 group-hover:shadow-[0_4px_10px_rgba(248,113,113,0.2)]">{tag}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
