"use client";

import AnimatedNumber from "@/components/AnimatedNumber";

/** 展示媒体类别标题、总数量、观看进度和平均评分；评分为 null 时显示「暂无评分」。 */
export default function CategoryHeaderCards({
  year,
  categoryName,
  watchedCount,
  totalCount,
  watchedPercent,
  avgRating,
  avgRatingPercent,
}: {
  year: string;
  categoryName: string;
  watchedCount: number;
  totalCount: number;
  watchedPercent: number;
  avgRating: number | null;
  avgRatingPercent: number;
}) {
  const safeWatched = Number.isFinite(watchedCount) ? watchedCount : 0;
  const safeTotal = Number.isFinite(totalCount) ? totalCount : 0;
  const safePercent = Number.isFinite(watchedPercent) ? watchedPercent : 0;
  const safeRatingPercent = Number.isFinite(avgRatingPercent) ? avgRatingPercent : 0;
  const hasRating = avgRating != null && Number.isFinite(avgRating);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
      <div className="surface-card col-span-1 flex flex-col justify-center rounded-2xl p-4 sm:p-5 lg:col-span-3 lg:p-6">
        <div className="text-fg-secondary mb-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {year} {categoryName} 阅览进度
          </h3>
        </div>
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-mono text-white">
              <AnimatedNumber value={safeWatched} />
            </span>
            <span className="text-sm text-fg-secondary font-medium">
              / <AnimatedNumber value={safeTotal} /> 部 (已看 / 总数)
            </span>
          </div>
          <div className="progress-track h-2 w-full overflow-hidden rounded-full">
            <div
              className="progress-fill h-full rounded-full"
              style={{
                width: `${safePercent}%`,
                transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
        </div>
      </div>

      <div className="surface-card col-span-1 flex flex-col justify-center rounded-2xl p-4 sm:p-5 lg:p-6">
        <div className="text-fg-secondary mb-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">平均{categoryName}评分</h3>
        </div>
        <div>
          {hasRating ? (
            <>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-mono text-white">
                  <AnimatedNumber value={avgRating} decimals={1} />
                </span>
                <span className="text-sm text-fg-secondary font-medium">/ 10</span>
              </div>
              <div className="progress-track h-2 w-full overflow-hidden rounded-full">
                <div
                  className="progress-fill h-full rounded-full"
                  style={{
                    width: `${safeRatingPercent}%`,
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
  );
}
