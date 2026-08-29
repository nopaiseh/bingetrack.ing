"use client";

import Image from "next/image";
import Link from "next/link";
import { ImageIcon, Star } from "lucide-react";
import { useState } from "react";
import { Media } from "@/lib/types";

function ItemCard({ item }: { item: Media }) {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  // Combine genres and languages, then limit to a maximum of 4 items
  const tags = [...(item.genres ?? []), ...(item.languages ?? [])].slice(0, 4);

  return (
    <>
      <div className="w-full aspect-[2/3] relative flex items-center justify-center overflow-hidden bg-black/60">
        {item.cover_url ? (
          <>
            {!isImageLoaded && <div className="absolute inset-0 animate-pulse bg-white/8" />}
            <Image
              src={item.cover_url}
              alt={item.title}
              fill
              className={`object-cover transition-[opacity,transform,filter] duration-500 group-hover:scale-110 ${
                isImageLoaded ? "opacity-100 blur-none" : "opacity-0 blur-sm"
              }`}
              sizes="176px"
              onLoad={() => setIsImageLoaded(true)}
            />
          </>
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
            {item.date ? item.date.substring(0, 4) : "未知"}
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
              className="w-fit min-w-[36px] shrink truncate text-center px-1.5 py-0.5 rounded-md bg-white/5 backdrop-blur-md border border-white/10 text-white/70 text-[9px] sm:text-[10px] font-medium tracking-wide transition-all duration-300 group-hover:bg-red-500/15 group-hover:text-red-300 group-hover:border-red-400/30 group-hover:shadow-[0_4px_10px_rgba(248,113,113,0.2)]"
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
}: {
  title: string;
  items: Media[];
  viewAllLink?: string;
  type?: "movies" | "series";
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
      <div className="flex space-x-4 overflow-x-auto no-scrollbar pt-4 pb-12 -mb-8 px-1 snap-x snap-mandatory scroll-pl-2">
        {items.map((media: Media) => {
          const mediaType = type ?? media.type ?? "movies";
          return (
            <Link
              href={`/${mediaType}/${media.id}`}
              key={media.id}
              className="glass-card group flex w-44 flex-none snap-start cursor-pointer flex-col overflow-hidden rounded-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-red-400/40 hover:bg-white/10 hover:shadow-[0_15px_40px_rgba(248,113,113,0.2)]"
            >
              <ItemCard item={media} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
