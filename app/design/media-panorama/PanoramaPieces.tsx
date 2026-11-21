"use client";

import AnimatedNumber from "@/components/AnimatedNumber";
import { MOCK_TYPES, MOCK_YEAR, percent, type PanoramaTypeStats } from "./mock-data";

/** 状态小卡；允许 0 计数与自定义量词（部／首／本）。 */
export function StatusTile({
  title,
  icon,
  toneClass,
  count,
  unit,
  details,
  empty,
}: {
  title: string;
  icon: string;
  toneClass: string;
  count: number;
  unit: string;
  details?: string;
  empty?: boolean;
}) {
  return (
    <div
      className={`surface-inline flex min-w-0 flex-col gap-3 rounded-2xl p-3 sm:p-4 ${
        empty ? "opacity-55" : ""
      }`}
    >
      <div className="flex items-center gap-2.5 text-sm font-semibold text-fg">
        <span className={`${icon} size-4 inline-block ${toneClass}`} aria-hidden="true" />
        <span>{title}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-3xl tracking-tight text-white sm:text-4xl">
          <AnimatedNumber value={count} />
        </span>
        <span className="text-sm text-fg-secondary">{unit}</span>
      </div>
      <p className="font-mono text-xs text-fg-secondary" aria-hidden={details ? undefined : true}>
        {details || " "}
      </p>
    </div>
  );
}

function ProgressBlock({
  label,
  done,
  total,
  unitSuffix,
}: {
  label: string;
  done: number;
  total: number;
  unitSuffix: string;
}) {
  const pct = percent(done, total);
  return (
    <div className="mt-auto flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-medium text-fg-secondary">
        <span>{label}</span>
        <span className="font-mono text-fg">
          {done} / {total} {unitSuffix} · {pct}%
        </span>
      </div>
      <div className="progress-track h-2 w-full overflow-hidden rounded-full">
        <div className="progress-fill h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** 与现网 OverviewBoards 同风格的单类看板；状态格数随后端字段（专辑仅已听）。 */
export function TypeBoard({
  type,
  compact = false,
}: {
  type: PanoramaTypeStats;
  compact?: boolean;
}) {
  const empty = type.total <= 0;
  const cols =
    type.statuses.length >= 3
      ? "grid-cols-3 gap-2.5 sm:gap-4"
      : type.statuses.length === 1
        ? "grid-cols-1 gap-3 sm:gap-4"
        : "grid-cols-2 gap-3 sm:gap-4";

  return (
    <div
      className={`dashboard-deferred surface-card flex h-full flex-col rounded-3xl ${
        compact ? "gap-4 p-3.5 sm:p-4" : "gap-6 p-4 sm:p-5 lg:p-7"
      } ${empty ? "opacity-80" : ""}`}
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="stat-icon flex items-center justify-center rounded-lg p-2">
            <span className={`${type.icon} size-4 inline-block`} aria-hidden="true" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-wide text-fg-secondary">{type.label}看板</span>
            <p className="mt-0.5 font-mono text-xs text-fg-muted">
              共 <AnimatedNumber value={type.total} /> {type.unit}
            </p>
          </div>
        </div>
        {empty && (
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-fg-muted">
            暂无收录
          </span>
        )}
      </div>

      <div className={`grid ${cols}`}>
        {type.statuses.map((status) => (
          <StatusTile
            key={status.id}
            title={status.label}
            icon={status.icon}
            toneClass={status.toneClass}
            count={status.count}
            unit={type.unit}
            details={status.details}
            empty={empty}
          />
        ))}
      </div>

      {type.progressLabel ? (
        <ProgressBlock
          label={type.progressLabel}
          done={type.done}
          total={type.doneTotal}
          unitSuffix={type.id === "tv_show" ? "集" : type.unit}
        />
      ) : (
        <p className="mt-auto text-xs text-fg-muted">暂无阅读记录</p>
      )}
    </div>
  );
}

/** 媒体全景标题区：可配置右侧统计格。 */
export function PanoramaIntro({
  stats,
  footnote,
}: {
  stats: Array<{ label: string; value: number; accent?: boolean }>;
  footnote?: string;
}) {
  const cols =
    stats.length <= 3 ? "grid-cols-3" : stats.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3 sm:grid-cols-5";

  return (
    <section
      aria-labelledby="dashboard-title"
      className="surface-panel dashboard-intro relative z-10 mb-2 rounded-3xl p-5 sm:p-6 lg:px-8 lg:py-6"
    >
      <div className="relative">
        <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-light)]/90">
          <span className="h-px w-8 bg-[var(--accent)]" />
          <span>{MOCK_YEAR}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-3xl">
            <h1
              id="dashboard-title"
              className="font-serif-movie text-3xl font-black leading-none text-white sm:text-4xl lg:text-5xl"
            >
              媒体全景
            </h1>
            <p className="mt-2 max-w-xl text-xs leading-5 text-fg-secondary sm:mt-2.5 sm:text-sm sm:leading-6">
              收录我倾注在光影、声音与文字里的时光。
            </p>
            {footnote ? <p className="mt-2 text-xs text-fg-muted">{footnote}</p> : null}
          </div>

          <dl className={`grid ${cols} gap-2 border-t border-white/10 pt-4 lg:min-w-100 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0`}>
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs tracking-wide text-fg-secondary">{stat.label}</dt>
                <dd
                  className={`mt-1 font-mono text-2xl font-normal tracking-tight sm:text-3xl ${
                    stat.accent ? "text-[var(--accent-light)]" : "text-white"
                  }`}
                >
                  <AnimatedNumber value={stat.value} />
                  {stat.accent ? "%" : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="relative mt-5 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-4 md:flex-row md:items-center">
        <div
          className="relative grid grid-flow-col auto-cols-fr items-center rounded-full bg-black/25 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
          role="tablist"
          aria-label="仪表板视图"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1 bottom-1 w-[calc((100%-8px)/3)] rounded-full bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_14px_rgba(0,0,0,0.25)]"
          />
          {["总览", "电影", "电视节目"].map((tab, index) => (
            <span
              key={tab}
              role="tab"
              aria-selected={index === 0}
              className={`relative z-10 rounded-full px-5 py-2 text-sm font-medium ${
                index === 0 ? "font-bold text-white" : "text-fg-secondary"
              }`}
            >
              {tab}
            </span>
          ))}
        </div>
        <span className="text-xs text-fg-muted">年份选择器（原型占位）</span>
      </div>
    </section>
  );
}

/** 方案 C：一行一类；状态格数跟随 release_year_stats 实际列。 */
export function DensityRow({ type }: { type: PanoramaTypeStats }) {
  const empty = type.total <= 0;
  const pct = percent(type.done, type.doneTotal);
  const statusCols =
    type.statuses.length >= 3 ? "grid-cols-3" : type.statuses.length === 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2";

  return (
    <div
      className={`surface-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5 ${empty ? "opacity-80" : ""}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="stat-icon flex items-center justify-center rounded-lg p-2">
            <span className={`${type.icon} size-4 inline-block`} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-wide text-fg-secondary">{type.label}</p>
            <p className="mt-0.5 font-mono text-2xl text-white">
              <AnimatedNumber value={type.total} />
              <span className="ml-1 text-sm font-sans text-fg-secondary">{type.unit}</span>
            </p>
          </div>
        </div>
        {empty ? (
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-fg-muted">
            暂无收录
          </span>
        ) : type.progressLabel ? (
          <p className="font-mono text-xs text-fg-secondary">
            {type.progressLabel} {pct}%
          </p>
        ) : null}
      </div>

      <div className={`grid gap-2 sm:gap-3 ${statusCols}`}>
        {type.statuses.map((status) => (
          <div
            key={status.id}
            className={`surface-inline rounded-2xl px-3 py-3 ${empty ? "opacity-55" : ""}`}
          >
            <div className={`flex items-center gap-1.5 text-xs font-semibold ${status.toneClass}`}>
              <span className={`${status.icon} size-3.5 inline-block`} aria-hidden="true" />
              {status.label}
            </div>
            <p className="mt-1.5 font-mono text-xl text-white sm:text-2xl">
              <AnimatedNumber value={status.count} />
              <span className="ml-1 text-sm font-sans text-fg-secondary">{type.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {type.progressLabel ? (
        <div className="progress-track h-1.5 w-full overflow-hidden rounded-full">
          <div className="progress-fill h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

