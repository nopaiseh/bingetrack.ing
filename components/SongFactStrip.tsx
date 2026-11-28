import type { ReactNode } from "react";
import { ratingTierLabel } from "@/components/MediaRatingBadge";
import { formatTrackDuration } from "@/lib/album-display";
import { listenStatusLabel } from "@/lib/listen-status";
import type { SongDetail } from "@/lib/types/song";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-[var(--surface-panel)] px-4 py-3.5 sm:px-5 sm:py-4">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="mt-1 flex min-h-11 min-w-0 items-center text-sm leading-5 text-fg">{children}</dd>
    </div>
  );
}

function releaseFact(releaseDate: string | null): string {
  if (!releaseDate?.trim()) return "—";
  const trimmed = releaseDate.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const year = trimmed.match(/\d{4}/)?.[0];
  return year ?? "—";
}

/** 歌曲事实条：发行／时长／状态／我的评分，样式对齐影视详情。 */
export default function SongFactStrip({ song }: { song: SongDetail }) {
  const duration = formatTrackDuration(song.duration_seconds);
  const status = listenStatusLabel(song.tracking?.status ?? null);
  const rating = song.tracking?.rating ?? null;
  const score = rating == null ? null : Number(rating).toFixed(1);
  const tier = ratingTierLabel(rating);

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
      <Fact label="发行">
        <span className="font-mono">{releaseFact(song.release_date)}</span>
      </Fact>
      <Fact label="时长">{duration ? <span className="font-mono">{duration}</span> : "—"}</Fact>
      <Fact label="状态">{status ?? "—"}</Fact>
      <Fact label="我的评分">
        {score == null ? (
          <span className="text-fg-secondary">未评分</span>
        ) : (
          <span className="inline-flex items-baseline gap-2">
            <span className="font-mono text-sm">{score}</span>
            {tier ? <span className="text-sm text-fg-muted">{tier}</span> : null}
          </span>
        )}
      </Fact>
    </dl>
  );
}
