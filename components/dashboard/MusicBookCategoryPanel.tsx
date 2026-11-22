"use client";

import dynamic from "next/dynamic";
import CatalogEmptyState from "@/components/CatalogEmptyState";
import AnimatedNumber from "@/components/AnimatedNumber";
import MediaStatusCard from "@/components/dashboard/MediaStatusCard";
import { getStatusSearchLink } from "@/components/dashboard/dashboard-links";
import type { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { WATCH_STATUSES } from "@/components/watch-status";

const DistributionTop5Cards = dynamic(() => import("@/components/dashboard/DistributionTop5Cards"), {
  loading: () => <div className="min-h-60 rounded-2xl bg-white/5 animate-pulse" />,
});

type MusicBookKind = "music" | "books";

/** 音乐或图书标签：状态卡、平均评分、可选曲目进度与分布；无精选轮播。 */
export default function MusicBookCategoryPanel({
  stats,
  kind,
  selectedYear,
}: {
  stats: DashboardStats;
  kind: MusicBookKind;
  selectedYear: string;
}) {
  const yearLabel = selectedYear === "All Time" ? "全时段" : selectedYear;
  const isMusic = kind === "music";
  const panelKey = isMusic ? "music" : "books";
  const categoryName = isMusic ? "音乐" : "图书";
  const total = isMusic ? stats.totalAlbums : stats.totalBooks;
  const unit = isMusic ? "张" : "本";
  const avgRating = isMusic ? stats.avgAlbumsRating : stats.avgBooksRating;
  const avgRatingPercent = isMusic ? stats.avgAlbumsRatingPercent : stats.avgBooksRatingPercent;
  const distribution = isMusic ? stats.albumDistribution : stats.bookDistribution;
  const hasRating = avgRating != null && Number.isFinite(avgRating);
  const empty = total <= 0;
  const showTrackProgress = isMusic && stats.totalTracks > 0;

  return (
    <div
      id={`dashboard-panel-${panelKey}`}
      role="tabpanel"
      aria-labelledby={`dashboard-tab-${panelKey}`}
      className="animate-fade-in flex flex-col gap-4 md:gap-6"
    >
      {empty ? (
        <CatalogEmptyState
          title={isMusic ? "暂无收听记录" : "暂无阅读记录"}
          description={
            isMusic
              ? "这一年还没有收录专辑。收录后会在这里展示收听进度、评分与分布。"
              : "这一年还没有收录图书。收录后会在这里展示阅读进度、评分与分布。"
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
            <div className="surface-card col-span-1 flex flex-col justify-center rounded-2xl p-4 sm:p-5 lg:col-span-3 lg:p-6">
              <div className="mb-4 flex items-center justify-between text-fg-secondary">
                <h3 className="text-lg font-semibold">
                  {yearLabel} {categoryName} {isMusic ? "收听进度" : "阅读进度"}
                </h3>
                <p className="font-mono text-xs text-fg-muted sm:text-sm">
                  共 <AnimatedNumber value={total} /> {unit}
                </p>
              </div>

              {isMusic ? (
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <MediaStatusCard
                    title="已听"
                    icon="i-material-symbols-check-circle-outline-rounded"
                    toneClass={WATCH_STATUSES.watched.textClass}
                    count={stats.listenedAlbums}
                    unit="张"
                    href={getStatusSearchLink("album", "watched", selectedYear)}
                  />
                  <MediaStatusCard
                    title="想听"
                    icon="i-material-symbols-bookmark-outline-rounded"
                    toneClass={WATCH_STATUSES.want_to_watch.textClass}
                    count={stats.wantAlbums}
                    unit="张"
                    href={getStatusSearchLink("album", "want_to_watch", selectedYear)}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                  <MediaStatusCard
                    title="已读"
                    icon="i-material-symbols-check-circle-outline-rounded"
                    toneClass={WATCH_STATUSES.watched.textClass}
                    count={stats.readBooks}
                    unit="本"
                    href={getStatusSearchLink("book", "watched", selectedYear)}
                  />
                  <MediaStatusCard
                    title="在读"
                    icon="i-material-symbols-menu-book-outline-rounded"
                    toneClass={WATCH_STATUSES.in_progress.textClass}
                    count={stats.readingBooks}
                    unit="本"
                    href={getStatusSearchLink("book", "in_progress", selectedYear)}
                  />
                  <MediaStatusCard
                    title="想读"
                    icon="i-material-symbols-bookmark-outline-rounded"
                    toneClass={WATCH_STATUSES.want_to_watch.textClass}
                    count={stats.wantBooks}
                    unit="本"
                    href={getStatusSearchLink("book", "want_to_watch", selectedYear)}
                  />
                </div>
              )}

              {showTrackProgress ? (
                <div className="mt-5 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-medium text-fg-secondary">
                    <span>曲目收听进度</span>
                    <span className="font-mono text-fg">
                      {stats.listenedTracks} / {stats.totalTracks} 首 · {stats.tracksPercent}%
                    </span>
                  </div>
                  <div
                    className="progress-track h-2 w-full overflow-hidden rounded-full"
                    role="progressbar"
                    aria-label={`已听 ${stats.listenedTracks} 首，共 ${stats.totalTracks} 首`}
                    aria-valuenow={stats.tracksPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="progress-fill h-full rounded-full"
                      style={{
                        width: `${stats.tracksPercent}%`,
                        transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="surface-card col-span-1 flex flex-col justify-center rounded-2xl p-4 sm:p-5 lg:p-6">
              <div className="mb-4 flex items-center justify-between text-fg-secondary">
                <h3 className="text-lg font-semibold">平均{categoryName}评分</h3>
              </div>
              <div>
                {hasRating ? (
                  <>
                    <div className="mb-2 flex items-baseline gap-2">
                      <span className="font-mono text-4xl text-white">
                        <AnimatedNumber value={avgRating} decimals={1} />
                      </span>
                      <span className="text-sm font-medium text-fg-secondary">/ 10</span>
                    </div>
                    <div className="progress-track h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="progress-fill h-full rounded-full"
                        style={{
                          width: `${Number.isFinite(avgRatingPercent) ? avgRatingPercent : 0}%`,
                          transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-2xl font-medium text-fg-muted sm:text-3xl">暂无评分</p>
                )}
              </div>
            </div>
          </div>

          <DistributionTop5Cards distribution={distribution} regionTitle="产地分布 Top 5" />
        </>
      )}
    </div>
  );
}
