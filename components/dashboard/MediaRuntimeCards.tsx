"use client";

import AnimatedNumber from "@/components/AnimatedNumber";

/** 将完成比例四舍五入为百分数并限制在 0 到 100；总数非正时返回 0。 */
function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(Math.round((value / total) * 100), 0), 100);
}

/** 把观看分钟数换算为整数小时，展示已看、未看时长和完成比例。 */
export default function MediaRuntimeCards({
  watchedRuntime,
  unwatchedRuntime,
  totalRuntime,
}: {
  watchedRuntime: number;
  unwatchedRuntime: number;
  totalRuntime: number;
}) {
  const completionPercent = percent(watchedRuntime, totalRuntime);
  const watchedHours = Math.round(watchedRuntime / 60);
  const unwatchedHours = Math.round(unwatchedRuntime / 60);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
      <div className="surface-card interactive-card group flex flex-col justify-between rounded-2xl p-4 sm:p-5 lg:p-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-white/60">
            <div className="stat-icon flex items-center justify-center rounded-lg p-2">
              <span className="i-material-symbols-play-circle-outline-rounded size-4 inline-block" aria-hidden="true" />
            </div>
            <span className="text-sm font-bold tracking-wide text-white/80 transition-colors group-hover:text-white">已看总时长</span>
          </div>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="font-mono text-5xl tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              <AnimatedNumber value={watchedHours} />
            </span>
            <span className="font-medium text-white/50">小时</span>
          </div>
        </div>
        <p className="mt-4 border-t border-white/10 pt-4 text-xs text-white/50">
          相当于连续观看约 {Math.round(watchedHours / 24)} 天
        </p>
      </div>

      <div className="surface-card interactive-card group flex flex-col justify-between rounded-2xl p-4 sm:p-5 lg:p-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-white/60">
            <div className="stat-icon flex items-center justify-center rounded-lg p-2">
              <span className="i-material-symbols-layers-rounded size-4 inline-block" aria-hidden="true" />
            </div>
            <span className="text-sm font-bold tracking-wide text-white/80 transition-colors group-hover:text-white">待看总时长</span>
          </div>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="font-mono text-5xl tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              <AnimatedNumber value={unwatchedHours} />
            </span>
            <span className="font-medium text-white/50">小时</span>
          </div>
        </div>
        <p className="mt-4 border-t border-white/10 pt-4 text-xs text-white/50">尚未完成的内容时长</p>
      </div>

      <div className="surface-card interactive-card group flex flex-col justify-between rounded-2xl p-4 sm:p-5 lg:p-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-white/60">
            <div className="stat-icon flex items-center justify-center rounded-lg p-2">
              <span className="i-material-symbols-pie-chart-outline-rounded size-4 inline-block" aria-hidden="true" />
            </div>
            <span className="text-sm font-bold tracking-wide text-white/80 transition-colors group-hover:text-white">完成进度</span>
          </div>
          <div className="mb-4 flex items-baseline gap-2">
            <span
              className="font-mono text-5xl tracking-tighter text-accent-light text-[var(--accent-light)] drop-shadow-[0_0_10px_var(--accent-glow-soft)]"
              style={{ color: "var(--accent-light)" }}
            >
              <AnimatedNumber value={completionPercent} />%
            </span>
            <span className="font-medium text-white/50">已完成</span>
          </div>
        </div>
        <div className="progress-track mt-2 h-2 w-full overflow-hidden rounded-full shadow-inner">
          <div className="h-full rounded-full bg-linear-to-r from-[var(--accent-dark)] to-[var(--accent-hover)] shadow-[0_0_12px_var(--accent-glow)]" style={{ width: `${completionPercent}%` }} />
        </div>
      </div>
    </div>
  );
}

