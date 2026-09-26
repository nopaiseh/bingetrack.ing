"use client";

import AnimatedNumber from "@/components/AnimatedNumber";
import { parseRuntimeParts } from "@/lib/format-runtime";

/** 将完成比例四舍五入为百分数并限制在 0 到 100；总数非正时返回 0。 */
function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(Math.round((value / total) * 100), 0), 100);
}

/** 渲染拆分后的天、小时、分钟及对应动画数字；全 0 时兜底展示 0 分钟。 */
function RuntimeValue({ runtime }: { runtime: number }) {
  const { days, hours, minutes } = parseRuntimeParts(runtime);
  const isZero = days === 0 && hours === 0 && minutes === 0;

  return (
    <div className="mb-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      {days > 0 && (
        <span className="inline-flex items-baseline gap-1">
          <span className="font-mono text-3xl sm:text-4xl lg:text-4xl xl:text-5xl tracking-tighter text-white">
            <AnimatedNumber value={days} />
          </span>
          <span className="font-medium text-white/50 text-sm sm:text-base">天</span>
        </span>
      )}
      {hours > 0 && (
        <span className="inline-flex items-baseline gap-1">
          <span className="font-mono text-3xl sm:text-4xl lg:text-4xl xl:text-5xl tracking-tighter text-white">
            <AnimatedNumber value={hours} />
          </span>
          <span className="font-medium text-white/50 text-sm sm:text-base">小时</span>
        </span>
      )}
      {(minutes > 0 || isZero) && (
        <span className="inline-flex items-baseline gap-1">
          <span className="font-mono text-3xl sm:text-4xl lg:text-4xl xl:text-5xl tracking-tighter text-white">
            <AnimatedNumber value={minutes} />
          </span>
          <span className="font-medium text-white/50 text-sm sm:text-base">分钟</span>
        </span>
      )}
    </div>
  );
}

/** 把观看分钟数换算为天、小时、分钟，展示已看、待看时长和完成比例。 */
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

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
      <div className="surface-card flex flex-col justify-between rounded-2xl p-4 sm:p-5 lg:p-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-white/60">
            <div className="stat-icon flex items-center justify-center rounded-lg p-2">
              <span className="i-material-symbols-play-circle-outline-rounded size-4 inline-block" aria-hidden="true" />
            </div>
            <span className="text-sm font-bold tracking-wide text-white/80">已看总时长</span>
          </div>
          <RuntimeValue runtime={watchedRuntime} />
        </div>
        <p className="mt-4 border-t border-white/10 pt-4 text-xs text-white/50">
          倾注在光影与故事里的专注时光
        </p>
      </div>

      <div className="surface-card flex flex-col justify-between rounded-2xl p-4 sm:p-5 lg:p-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-white/60">
            <div className="stat-icon flex items-center justify-center rounded-lg p-2">
              <span className="i-material-symbols-layers-rounded size-4 inline-block" aria-hidden="true" />
            </div>
            <span className="text-sm font-bold tracking-wide text-white/80">待看总时长</span>
          </div>
          <RuntimeValue runtime={unwatchedRuntime} />
        </div>
        <p className="mt-4 border-t border-white/10 pt-4 text-xs text-white/50">
          等待翻开的精彩篇章
        </p>
      </div>

      <div className="surface-card flex flex-col justify-between rounded-2xl p-4 sm:p-5 lg:p-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-white/60">
            <div className="stat-icon flex items-center justify-center rounded-lg p-2">
              <span className="i-material-symbols-pie-chart-outline-rounded size-4 inline-block" aria-hidden="true" />
            </div>
            <span className="text-sm font-bold tracking-wide text-white/80">完成进度</span>
          </div>
          <div className="mb-2 flex items-baseline gap-2">
            <span
              className="font-mono text-3xl sm:text-4xl lg:text-4xl xl:text-5xl tracking-tighter text-accent-light text-[var(--accent-light)]"
              style={{ color: "var(--accent-light)" }}
            >
              <AnimatedNumber value={completionPercent} />%
            </span>
            <span className="font-medium text-white/50 text-sm sm:text-base">已完成</span>
          </div>
        </div>
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="progress-track h-2 w-full overflow-hidden rounded-full">
            <div className="progress-fill h-full rounded-full" style={{ width: `${completionPercent}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}


