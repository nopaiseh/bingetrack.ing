"use client";

import type { ReactNode } from "react";
import MediaStatusCard from "@/components/dashboard/MediaStatusCard";
import { getStatusSearchLink } from "@/components/dashboard/dashboard-links";
import type { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { WATCH_STATUSES } from "@/components/watch-status";

/** 总览四格：电影／电视／音乐（首）／图书（本）；空类弱化并标「暂无收录」。 */
export default function OverviewBoards({ stats, selectedYear }: { stats: DashboardStats; selectedYear: string }) {
  const {
    watchedMovies,
    unwatchedMovies,
    totalMovies,
    moviesPercent,
    watchedSeries,
    watchingSeries,
    unwatchedSeries,
    totalSeries,
    watchedEpisodes,
    unwatchedEpisodes,
    totalEpisodes,
    seriesEpisodesPercent,
    totalTracks,
    listenedTracks,
    wantTracks,
    tracksPercent,
    totalBooks,
    readBooks,
    readingBooks,
    wantBooks,
    booksPercent,
  } = stats;
  const watchedSeasons = Number(stats.currentYearData?.watched_seasons) || 0;
  const watchingSeasons = Number(stats.currentYearData?.watching_seasons) || 0;
  const unwatchedSeasons = Number(stats.currentYearData?.unwatched_seasons) || 0;

  const musicEmpty = totalTracks <= 0;
  const booksEmpty = totalBooks <= 0;

  return (
    <div
      id="dashboard-panel-overview"
      role="tabpanel"
      aria-labelledby="dashboard-tab-overview"
      className="flex flex-col gap-4 md:gap-6"
    >
      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
        <TypeBoardShell title="电影看板" icon="i-material-symbols-movie-rounded" total={totalMovies} unit="部">
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
          <ProgressFooter
            label="观影完成度"
            done={watchedMovies}
            total={totalMovies}
            unit="部"
            percent={moviesPercent}
          />
        </TypeBoardShell>

        <TypeBoardShell title="电视节目看板" icon="i-material-symbols-tv-rounded" total={totalSeries} unit="部">
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
          <ProgressFooter
            label="单集观看进度"
            done={watchedEpisodes}
            total={totalEpisodes}
            unit="集"
            percent={seriesEpisodesPercent}
          />
        </TypeBoardShell>

        <TypeBoardShell
          title="音乐看板"
          icon="i-material-symbols-music-note-rounded"
          total={totalTracks}
          unit="首"
          empty={musicEmpty}
        >
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <MediaStatusCard
              title="已听"
              icon="i-material-symbols-check-circle-outline-rounded"
              toneClass={WATCH_STATUSES.watched.textClass}
              count={listenedTracks}
              unit="首"
              href={musicEmpty ? undefined : getStatusSearchLink("album", "watched", selectedYear)}
            />
            <MediaStatusCard
              title="想听"
              icon="i-material-symbols-bookmark-outline-rounded"
              toneClass={WATCH_STATUSES.want_to_watch.textClass}
              count={wantTracks}
              unit="首"
              href={musicEmpty ? undefined : getStatusSearchLink("album", "want_to_watch", selectedYear)}
            />
          </div>
          {musicEmpty ? (
            <p className="mt-auto text-xs text-fg-muted">暂无收听记录</p>
          ) : (
            <ProgressFooter
              label="已听占比"
              done={listenedTracks}
              total={totalTracks}
              unit="首"
              percent={tracksPercent}
            />
          )}
        </TypeBoardShell>

        <TypeBoardShell
          title="图书看板"
          icon="i-material-symbols-menu-book-rounded"
          total={totalBooks}
          unit="本"
          empty={booksEmpty}
        >
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            <MediaStatusCard
              title="已读"
              icon="i-material-symbols-check-circle-outline-rounded"
              toneClass={WATCH_STATUSES.watched.textClass}
              count={readBooks}
              unit="本"
              href={booksEmpty ? undefined : getStatusSearchLink("book", "watched", selectedYear)}
            />
            <MediaStatusCard
              title="在读"
              icon="i-material-symbols-menu-book-outline-rounded"
              toneClass={WATCH_STATUSES.in_progress.textClass}
              count={readingBooks}
              unit="本"
              href={booksEmpty ? undefined : getStatusSearchLink("book", "in_progress", selectedYear)}
            />
            <MediaStatusCard
              title="想读"
              icon="i-material-symbols-bookmark-outline-rounded"
              toneClass={WATCH_STATUSES.want_to_watch.textClass}
              count={wantBooks}
              unit="本"
              href={booksEmpty ? undefined : getStatusSearchLink("book", "want_to_watch", selectedYear)}
            />
          </div>
          {booksEmpty ? (
            <p className="mt-auto text-xs text-fg-muted">暂无阅读记录</p>
          ) : (
            <ProgressFooter label="已读占比" done={readBooks} total={totalBooks} unit="本" percent={booksPercent} />
          )}
        </TypeBoardShell>
      </div>
    </div>
  );
}

function TypeBoardShell({
  title,
  icon,
  total,
  unit,
  empty = false,
  children,
}: {
  title: string;
  icon: string;
  total: number;
  unit: string;
  empty?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`dashboard-deferred surface-card flex h-full flex-col gap-6 rounded-3xl p-4 sm:p-5 lg:p-7 ${
        empty ? "opacity-80" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="stat-icon flex items-center justify-center rounded-lg p-2">
            <span className={`${icon} size-4 inline-block`} aria-hidden="true" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-wide text-fg-secondary">{title}</span>
            <p className="mt-0.5 font-mono text-xs text-fg-muted">
              共 {Number.isFinite(total) ? total : 0} {unit}
            </p>
          </div>
        </div>
        {empty ? (
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-fg-muted">暂无收录</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function ProgressFooter({
  label,
  done,
  total,
  unit,
  percent,
}: {
  label: string;
  done: number;
  total: number;
  unit: string;
  percent: number;
}) {
  const safeDone = Number.isFinite(done) ? done : 0;
  const safeTotal = Number.isFinite(total) ? total : 0;
  const safePercent = Number.isFinite(percent) ? percent : 0;
  return (
    <div className="mt-auto flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-medium text-fg-secondary">
        <span>{label}</span>
        <span className="font-mono text-fg">
          {safeDone} / {safeTotal} {unit} · {safePercent}%
        </span>
      </div>
      <div className="progress-track h-2 w-full overflow-hidden rounded-full">
        <div
          className="progress-fill h-full rounded-full transition-all duration-500"
          style={{ width: `${safePercent}%` }}
        />
      </div>
    </div>
  );
}
