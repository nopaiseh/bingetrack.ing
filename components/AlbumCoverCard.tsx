"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import LetterTile from "@/components/LetterTile";
import MediaRatingBadge from "@/components/MediaRatingBadge";
import { ALBUM_COVER_SIZES } from "@/lib/poster-image-sizes";
import { publicMediaDetailPath } from "@/lib/media-types";
import type { MediaCard } from "@/lib/types";

/** 紧凑封面墙卡片：1:1 封面 + 标题／主艺人 + 可选评分。 */
export default function AlbumCoverCard({ item, eager = false }: { item: MediaCard; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const title = item.title.trim() || "未命名专辑";
  const artist = (item.artists ?? []).filter(Boolean)[0] ?? null;
  const href = publicMediaDetailPath("albums", item.id);
  const showCover = Boolean(item.cover_url) && !failed;

  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col gap-1.5 focus-ring rounded-lg"
      aria-label={artist ? `${title}，${artist}` : title}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-[var(--surface-2)] ring-1 ring-[var(--border)] transition group-hover:ring-white/25">
        {showCover ? (
          <Image
            src={item.cover_url}
            alt=""
            fill
            sizes={ALBUM_COVER_SIZES}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            loading={eager ? "eager" : "lazy"}
            onError={() => setFailed(true)}
          />
        ) : (
          <LetterTile title={title} decorative />
        )}
        {item.rating != null ? (
          <span className="pointer-events-none absolute bottom-1.5 right-1.5 z-10">
            <MediaRatingBadge rating={item.rating} size="sm" showTier={false} />
          </span>
        ) : null}
      </div>
      <div className="min-w-0 px-0.5">
        <p
          className="truncate text-xs font-semibold leading-4 text-fg group-hover:text-[var(--accent-hover)]"
          title={title}
        >
          {title}
        </p>
        {artist ? (
          <p className="truncate text-[11px] leading-4 text-fg-muted" title={artist}>
            {artist}
          </p>
        ) : (
          <p className="truncate text-[11px] leading-4 text-fg-subtle">—</p>
        )}
      </div>
    </Link>
  );
}
