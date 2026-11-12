import Link from "next/link";
import type { SeasonInfo } from "@/lib/types";
import { seasonListLabel } from "@/lib/season-label";

/** 已看完、看过一部分、还没看，对应单集列表里的状态胶囊。 */
function seasonWatchLabel(season: SeasonInfo): "已看" | "在看" | "未看" {
  if (season.episodeCount > 0 && season.watchedEpisodeCount >= season.episodeCount) return "已看";
  if (season.watchedEpisodeCount > 0) return "在看";
  return "未看";
}

/** 有观看记录时写出进度，否则只写集数。 */
function episodeCountLabel(season: SeasonInfo): string {
  if (season.watchedEpisodeCount > 0) return `${season.watchedEpisodeCount}/${season.episodeCount} 集`;
  return `${season.episodeCount} 集`;
}

/** 把年份范围里的连字符收成短横线；没有年份时不占位。 */
function yearLabel(season: SeasonInfo): string | null {
  const year = season.releaseYearRange?.trim();
  return year ? year.replace(/\s*-\s*/g, "–") : null;
}

/** 纯文字季行：季序号、统一季名、原标题、年份、集数和观看进度。 */
function SeasonListItem({ seriesId, season }: { seriesId: string; season: SeasonInfo }) {
  const label = seasonListLabel(season);
  const watchLabel = seasonWatchLabel(season);
  const year = yearLabel(season);
  const started = season.watchedEpisodeCount > 0;
  const percent = season.episodeCount > 0
    ? Math.min(100, Math.round((season.watchedEpisodeCount / season.episodeCount) * 100))
    : 0;
  const watched = watchLabel === "已看";

  return (
    <Link
      href={`/shows/${seriesId}/seasons/${season.id}`}
      className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5 px-3.5 py-4 transition-colors hover:bg-white/[0.04] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-5 sm:px-6 sm:py-5"
    >
      <div className={`font-mono text-[30px] font-light leading-none tracking-[-0.04em] sm:min-w-[76px] sm:pt-0.5 sm:text-right sm:text-[44px] ${started ? "text-[var(--accent-hover)]" : "text-fg-subtle"}`}>
        {season.seasonNumber}
      </div>
      <div className="min-w-0">
        <h3 className="break-words text-base font-bold leading-snug text-fg sm:text-[17px]">{label.title}</h3>
        {label.subtitle ? <p className="mt-0.5 break-words text-[12.5px] leading-snug text-fg-subtle">{label.subtitle}</p> : null}
        <p className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] text-fg-muted">
          {year ? <span>{year}</span> : null}
          {year ? <span aria-hidden="true" className="text-white/25">·</span> : null}
          <span>{episodeCountLabel(season)}</span>
        </p>
        {season.episodeCount > 0 ? (
          <div
            className="progress-track mt-2.5 h-1 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${label.title}观看进度`}
          >
            <div className="progress-fill h-full" style={{ width: `${percent}%` }} />
          </div>
        ) : null}
      </div>
      <div className="col-start-2 justify-self-start sm:col-start-3 sm:row-start-1 sm:self-start">
        <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${
          watched ? "border-[color-mix(in_srgb,var(--ok)_45%,var(--border))] bg-[var(--ok-soft)] text-[var(--ok)]" : "border-[var(--border)] bg-[var(--surface-2)] text-fg-muted"
        }`}>
          {watched ? <span className="i-material-symbols-check-circle-rounded inline-block size-3.5" aria-hidden="true" /> : null}
          {watchLabel}
        </span>
      </div>
    </Link>
  );
}

/** 电视节目详情里的季列表。用文字行代替同一张海报的季卡片，方便直接比较季名和进度。 */
export default function SeasonRow({
  seriesId,
  seasons,
}: {
  seriesId: string;
  seasons: SeasonInfo[];
}) {
  return (
    <div className="mb-12 mt-12">
      <div className="mb-5 flex items-center gap-2 border-b border-white/10 pb-3">
        <h2 className="text-xl font-bold tracking-wide text-white">季度列表</h2>
        {seasons.length > 0 ? (
          <span className="text-xs font-medium tracking-normal text-fg-subtle">共 {seasons.length} 季</span>
        ) : null}
      </div>
      {seasons.length === 0 ? (
        <div className="surface-muted rounded-xl border border-white/10 px-6 py-10 text-center text-sm text-fg-muted">
          暂无季集数据
        </div>
      ) : (
        <section className="surface-card divide-y divide-white/[0.07] overflow-hidden rounded-[20px]" aria-label="季度列表">
          {seasons.map((season) => <SeasonListItem key={season.id} seriesId={seriesId} season={season} />)}
        </section>
      )}
    </div>
  );
}
