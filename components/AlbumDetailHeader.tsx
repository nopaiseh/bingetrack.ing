import Image from "next/image";
import { Suspense } from "react";
import MediaBackLink, { DefaultMediaBackLink } from "@/components/MediaBackLink";
import LetterTile from "@/components/LetterTile";
import { ownershipLabel, type OwnershipStatus } from "@/lib/album-display";
import { listenStatusLabel } from "@/lib/listen-status";
import { ratingTierLabel } from "@/components/MediaRatingBadge";
import type { Media } from "@/lib/types";

function SquarePoster({ title, coverUrl }: { title: string; coverUrl: string }) {
  return (
    <div
      data-poster
      className="relative aspect-square w-full overflow-hidden rounded-xl shadow-[0_12px_30px_-16px_rgba(0,0,0,0.8)]"
    >
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt=""
          fill
          sizes="(max-width: 639px) 64px, 96px"
          className="object-cover"
          preload
          fetchPriority="high"
        />
      ) : (
        <LetterTile title={title} />
      )}
    </div>
  );
}

/** 方案 C 详情页头：小方封面 + 标题 + 元信息行（艺人、年、厂牌、曲目数、均分与已评数、拥有权）。 */
export default function AlbumDetailHeader({
  media,
  artists,
  trackCount,
  label,
  ratedCount,
  ownership,
}: {
  media: Media;
  artists: readonly string[];
  trackCount: number | null;
  label: string | null;
  ratedCount: number;
  ownership: OwnershipStatus | null;
}) {
  const year = String(media.release_year || media.date || "").match(/\d{4}/)?.[0] ?? "";
  const score = media.rating == null ? null : Number(media.rating).toFixed(1);
  const tier = ratingTierLabel(media.rating);
  const ownLabel = ownershipLabel(ownership);
  const listenLabel = listenStatusLabel(media.status);
  const artistLine = artists.filter(Boolean).join("、");
  const alternate = media.alternate_title && media.alternate_title !== media.title ? media.alternate_title : null;

  const metaItems = [
    artistLine ? <span key="artist">{artistLine}</span> : null,
    year ? (
      <span key="year" className="font-mono text-fg-secondary">
        {year}
      </span>
    ) : null,
    label ? <span key="label">{label}</span> : null,
    trackCount != null ? (
      <span key="tracks" className="font-mono">
        {trackCount} 首
      </span>
    ) : null,
    score != null ? (
      <span key="score" className="inline-flex items-baseline gap-1.5">
        <span className="font-mono text-fg">{score}</span>
        {tier ? <span className="text-fg-muted">{tier}</span> : null}
        {ratedCount > 0 ? <span className="text-fg-muted">（{ratedCount} 首已评）</span> : null}
      </span>
    ) : null,
    ownLabel ? (
      <span key="own" className="font-medium text-[var(--accent-hover)]">
        {ownLabel}
      </span>
    ) : null,
    listenLabel ? (
      <span key="listen" className="font-medium text-fg-secondary">
        {listenLabel}
      </span>
    ) : null,
  ].filter((item) => item != null);

  return (
    <header className="container mx-auto max-w-7xl px-4 pb-8 pt-24 sm:px-6 lg:px-8">
      <Suspense fallback={<DefaultMediaBackLink type="albums" />}>
        <MediaBackLink type="albums" />
      </Suspense>

      <div className="flex items-start gap-4 sm:gap-5">
        <div className="w-16 shrink-0 sm:w-24">
          <SquarePoster title={media.title} coverUrl={media.cover_url} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-balance break-words text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            {media.title}
          </h1>
          {alternate ? <p className="mt-1 text-sm text-fg-secondary">{alternate}</p> : null}
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
            {metaItems.flatMap((item, index) =>
              index === 0
                ? [item]
                : [
                    <span key={`dot-${index}`} aria-hidden="true" className="text-fg-subtle">
                      ·
                    </span>,
                    item,
                  ],
            )}
          </p>
        </div>
      </div>
    </header>
  );
}
