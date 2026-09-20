"use client";

import type { DistributionItem, MediaDistribution } from "@/lib/types";

/** 展示一个分布维度的名称和占比条，数据为空时显示暂无数据。 */
function DistributionCard({ title, icon, items }: { title: string; icon: string; items: DistributionItem[] }) {
  return (
    <div className="surface-card h-full rounded-2xl p-4 sm:p-5 lg:p-6">
      <div className="mb-5 flex h-8 items-center gap-3 text-sm text-white/70">
        <div className="surface-raised flex size-8 shrink-0 items-center justify-center rounded-lg shadow-[0_4px_10px_rgba(0,0,0,0.1)]">
          <span className={`${icon} size-4 inline-block text-[var(--accent)]`} aria-hidden="true" />
        </div>
        <span className="font-medium tracking-wide text-white/80">{title}</span>
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.name} className="flex items-center gap-3">
            <span className="w-20 truncate text-sm text-white/70" title={item.name}>{item.name}</span>
            <div className="progress-track h-1.5 flex-1 overflow-hidden rounded-full">
              <div className="h-full rounded-full bg-linear-to-r from-[var(--accent)] to-[var(--accent-hover)] transition-all duration-500" style={{ width: `${item.percent}%` }} />
            </div>
            <span className="text-xs text-white/60 w-8 text-right font-mono">{item.percent}%</span>
          </div>
        ))}
        {items.length === 0 && <span className="py-6 text-center text-sm text-white/60">暂无数据</span>}
      </div>
    </div>
  );
}

/** 将地区、语言和类型三个维度分别展示为前五名分布卡片。 */
export default function DistributionTop5Cards({ distribution }: { distribution: MediaDistribution }) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
      <DistributionCard title="影视产地分布 Top 5" icon="i-material-symbols-public-rounded" items={distribution.regions} />
      <DistributionCard title="主要语言 Top 5" icon="i-material-symbols-translate-rounded" items={distribution.languages} />
      <DistributionCard title="主要类型 Top 5" icon="i-material-symbols-more-horiz-rounded" items={distribution.genres} />
    </div>
  );
}

