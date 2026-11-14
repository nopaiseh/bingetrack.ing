"use client";

import MediaStatusCard from "@/components/dashboard/MediaStatusCard";
import { getStatusSearchLink } from "@/components/dashboard/dashboard-links";
import { WATCH_STATUSES } from "@/components/watch-status";

/** 总览标签下的电影与电视节目看板，含观看状态和完成度。 */
export default function OverviewBoards({
  selectedYear,
  watchedMovies,
  unwatchedMovies,
  totalMovies,
  moviesPercent,
  watchedSeries,
  watchingSeries,
  unwatchedSeries,
  watchedEpisodes,
  unwatchedEpisodes,
  totalEpisodes,
  seriesEpisodesPercent,
  watchedSeasons,
  watchingSeasons,
  unwatchedSeasons,
}: {
  selectedYear: string;
  watchedMovies: number;
  unwatchedMovies: number;
  totalMovies: number;
  moviesPercent: number;
  watchedSeries: number;
  watchingSeries: number;
  unwatchedSeries: number;
  watchedEpisodes: number;
  unwatchedEpisodes: number;
  totalEpisodes: number;
  seriesEpisodesPercent: number;
  watchedSeasons: number;
  watchingSeasons: number;
  unwatchedSeasons: number;
}) {
  return (
    <div key="overview" id="dashboard-panel-overview" role="tabpanel" aria-labelledby="dashboard-tab-overview" className="flex flex-col gap-4 md:gap-6">
      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
        <div className="dashboard-deferred surface-card flex h-full flex-col gap-6 rounded-3xl p-4 sm:p-5 lg:p-7">
          <div className="flex items-center border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="stat-icon flex items-center justify-center rounded-lg p-2">
                <span className="i-material-symbols-movie-rounded size-4 inline-block" aria-hidden="true" />
              </div>
              <span className="text-sm font-bold text-fg-secondary tracking-wide">
                电影看板
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <MediaStatusCard
              title={WATCH_STATUSES.watched.label}
              icon="i-material-symbols-check-circle-outline-rounded"
              toneClass={WATCH_STATUSES.watched.textClass}
              count={watchedMovies}
              href={getStatusSearchLink("movie", "watched", selectedYear)}
            />
            <MediaStatusCard
              title={WATCH_STATUSES.want_to_watch.label}
              icon="i-material-symbols-bookmark-outline-rounded"
              toneClass={WATCH_STATUSES.want_to_watch.textClass}
              count={unwatchedMovies}
              href={getStatusSearchLink("movie", "want_to_watch", selectedYear)}
            />
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-fg-secondary font-medium">
              <span>观影完成度</span>
              <span className="font-mono text-fg">{watchedMovies} / {totalMovies} 部 · {moviesPercent}%</span>
            </div>
            <div className="progress-track h-2 w-full overflow-hidden rounded-full">
              <div
                className="progress-fill h-full rounded-full transition-all duration-500"
                style={{ width: `${moviesPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="dashboard-deferred surface-card flex h-full flex-col gap-6 rounded-3xl p-4 sm:p-5 lg:p-7">
          <div className="flex items-center border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="stat-icon flex items-center justify-center rounded-lg p-2">
                <span className="i-material-symbols-tv-rounded size-4 inline-block" aria-hidden="true" />
              </div>
              <span className="text-sm font-bold text-fg-secondary tracking-wide">
                电视节目看板
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            <MediaStatusCard
              title={WATCH_STATUSES.watched.label}
              icon="i-material-symbols-check-circle-outline-rounded"
              toneClass={WATCH_STATUSES.watched.textClass}
              count={watchedSeries}
              details={`${watchedSeasons}季 · ${watchedEpisodes}集`}
              href={getStatusSearchLink("tv_show", "watched", selectedYear)}
            />
            <MediaStatusCard
              title={WATCH_STATUSES.watching.label}
              icon="i-material-symbols-play-circle-outline-rounded"
              toneClass={WATCH_STATUSES.watching.textClass}
              count={watchingSeries}
              details={`${watchingSeasons}季`}
              href={getStatusSearchLink("tv_show", "watching", selectedYear)}
            />
            <MediaStatusCard
              title={WATCH_STATUSES.want_to_watch.label}
              icon="i-material-symbols-bookmark-outline-rounded"
              toneClass={WATCH_STATUSES.want_to_watch.textClass}
              count={unwatchedSeries}
              details={`${unwatchedSeasons}季 · ${unwatchedEpisodes}集`}
              href={getStatusSearchLink("tv_show", "want_to_watch", selectedYear)}
            />
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-fg-secondary font-medium">
              <span>单集观看进度</span>
              <span className="font-mono text-fg">{watchedEpisodes} / {totalEpisodes} 集 · {seriesEpisodesPercent}%</span>
            </div>
            <div className="progress-track h-2 w-full overflow-hidden rounded-full">
              <div
                className="progress-fill h-full rounded-full transition-all duration-500"
                style={{ width: `${seriesEpisodesPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
