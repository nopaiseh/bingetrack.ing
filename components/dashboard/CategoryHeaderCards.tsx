"use client";

import AnimatedNumber from "@/components/AnimatedNumber";

/** 展示媒体类别标题、总数量、观看进度和平均评分。 */
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
  avgRating: number;
  avgRatingPercent: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
      <div className="surface-card col-span-1 flex flex-col justify-center rounded-2xl p-4 sm:p-5 lg:col-span-3 lg:p-6">
        <div className="text-white/60 mb-4 flex justify-between items-center">
          <i className="text-xl font-medium">{year} {categoryName} 阅览进度</i>
        </div>
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-mono text-white">
              <AnimatedNumber value={watchedCount} />
            </span>
            <span className="text-sm text-white/50 font-medium">
              / <AnimatedNumber value={totalCount} /> 部 (已看 / 总数)
            </span>
          </div>
          <div className="progress-track h-1.5 w-full overflow-hidden rounded-full shadow-inner">
            <div
              className="h-full bg-linear-to-r from-[var(--accent-dark)] to-[var(--accent-hover)] rounded-full"
              style={{
                width: `${watchedPercent}%`,
                transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
        </div>
      </div>

      <div className="surface-card col-span-1 flex flex-col justify-center rounded-2xl p-4 sm:p-5 lg:p-6">
        <div className="text-white/60 mb-4 flex justify-between items-center">
          <i className="text-xl font-medium">平均{categoryName}评分</i>
        </div>
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-mono text-white">
              <AnimatedNumber value={avgRating || 0} decimals={1} />
            </span>
            <span className="text-sm text-white/50 font-medium">/ 10</span>
          </div>
          <div className="progress-track h-1.5 w-full overflow-hidden rounded-full shadow-inner">
            <div
              className="h-full bg-linear-to-r from-[var(--accent-dark)] to-[var(--accent-hover)] rounded-full"
              style={{
                width: `${avgRatingPercent}%`,
                transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

