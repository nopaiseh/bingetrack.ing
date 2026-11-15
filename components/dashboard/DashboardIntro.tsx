"use client";

import DashboardYearPicker from "@/components/DashboardYearPicker";
import AnimatedNumber from "@/components/AnimatedNumber";

/** 展示看板标题、汇总数字、视图标签和年份选择器。 */
export default function DashboardIntro({
  selectedYear,
  totalMovies,
  totalSeries,
  runtimePercent,
  tabs,
  tabIds,
  activeTab,
  onSelectTab,
  years,
  onSelectYear,
}: {
  selectedYear: string;
  totalMovies: number;
  totalSeries: number;
  runtimePercent: number;
  tabs: readonly string[];
  tabIds: Record<string, string>;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  years: Array<string | number>;
  onSelectYear: (year: string) => void;
}) {
  return (
    <section aria-labelledby="dashboard-title" className="surface-panel dashboard-intro relative z-10 mb-2 rounded-3xl p-5 sm:p-6 lg:px-8 lg:py-6">
      <div className="relative">
        <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-light)]/90">
          <span className="h-px w-8 bg-[var(--accent)]" />
          <span>{selectedYear === "All Time" ? "全时段档案" : `${selectedYear} 年度档案`}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-3xl">
            <h1 id="dashboard-title" className="font-serif-movie text-3xl font-black leading-none text-white sm:text-4xl lg:text-5xl">
              媒体全景
            </h1>
            <p className="mt-2 max-w-xl text-xs leading-5 text-fg-secondary sm:mt-2.5 sm:text-sm sm:leading-6">
              收录我倾注在光影、声音与文字里的时光。
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-2 border-t border-white/10 pt-4 lg:min-w-100 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div>
              <dt className="text-xs tracking-wide text-fg-secondary">电影总计</dt>
              <dd className="mt-1 font-mono text-2xl font-normal tracking-tight text-white sm:text-3xl">
                <AnimatedNumber value={totalMovies} />
              </dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-fg-secondary">电视节目总计</dt>
              <dd className="mt-1 font-mono text-2xl font-normal tracking-tight text-white sm:text-3xl">
                <AnimatedNumber value={totalSeries} />
              </dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-fg-secondary">完成进度</dt>
              <dd
                className="mt-1 font-mono text-2xl font-normal tracking-tight text-[var(--accent-light)] sm:text-3xl"
              >
                <AnimatedNumber value={runtimePercent} />%
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="relative mt-5 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-4 md:flex-row md:items-center">
        {/* 标签等宽（取最宽者），滑块按等分宽度平移才能与每个标签对齐。 */}
        <div className="relative grid grid-flow-col auto-cols-fr items-center rounded-full bg-black/25 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]" role="tablist" aria-label="仪表板视图">
          {/* 平滑滑动的物理胶囊底块 */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_14px_rgba(0,0,0,0.25)] transition-transform duration-300 ease-out"
            style={{
              width: `calc((100% - 8px) / ${tabs.length})`,
              transform: `translateX(calc(${tabs.indexOf(activeTab)} * 100%))`,
            }}
          />

          {tabs.map(/* 为每个看板分类渲染可切换的标签按钮。 */ (tab) => (
            <button
              key={tab}
              onClick={/* 将点击的分类设为当前看板标签。 */ () => onSelectTab(tab)}
              role="tab"
              id={`dashboard-tab-${tabIds[tab]}`}
              aria-controls={`dashboard-panel-${tabIds[tab]}`}
              aria-selected={activeTab === tab}
              className={`relative z-10 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                activeTab === tab
                  ? "text-white font-bold"
                  : "text-fg-secondary hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <DashboardYearPicker
          years={years}
          selectedYear={selectedYear}
          onSelect={onSelectYear}
        />
      </div>
    </section>
  );
}
