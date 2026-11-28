"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import DashboardYearPicker from "@/components/DashboardYearPicker";
import AnimatedNumber from "@/components/AnimatedNumber";
import type { DashboardTab } from "@/components/dashboard/dashboard-url";

/** 展示看板标题、四类数量（音乐为曲目数）、影视完成进度、视图标签和年份选择器。 */
export default function DashboardIntro({
  selectedYear,
  totalMovies,
  totalSeries,
  totalTracks,
  totalBooks,
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
  /** 页头「音乐」按曲目数（total_tracks），与音乐标签卡片的专辑计数不同。 */
  totalTracks: number;
  totalBooks: number;
  runtimePercent: number;
  tabs: readonly DashboardTab[];
  tabIds: Record<DashboardTab, string>;
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  years: Array<string | number>;
  onSelectYear: (year: string) => void;
}) {
  const totals = [
    { label: "电影", value: totalMovies },
    { label: "电视节目", value: totalSeries },
    { label: "音乐", value: totalTracks },
    { label: "图书", value: totalBooks },
    { label: "完成进度", value: runtimePercent, accent: true as const },
  ];

  const tablistRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<DashboardTab, HTMLButtonElement | null>>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const activeButton = tabRefs.current[activeTab];
    const list = tablistRef.current;
    if (!activeButton || !list) return;

    setIndicator({ left: activeButton.offsetLeft, width: activeButton.offsetWidth });
    const listRect = list.getBoundingClientRect();
    const tabRect = activeButton.getBoundingClientRect();
    if (tabRect.left < listRect.left || tabRect.right > listRect.right) {
      activeButton.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
    }
  }, [activeTab, tabs]);

  /** 方向键在标签间移动焦点并切换；Home／End 跳到两端。 */
  function onTabListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const key = event.key;
    if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End") return;

    event.preventDefault();
    const currentIndex = tabs.indexOf(activeTab);
    let nextIndex = currentIndex;
    if (key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (key === "Home") nextIndex = 0;
    if (key === "End") nextIndex = tabs.length - 1;

    const nextTab = tabs[nextIndex] ?? activeTab;
    onSelectTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  }

  return (
    <section
      aria-labelledby="dashboard-title"
      className="surface-panel dashboard-intro relative z-10 mb-2 rounded-3xl p-5 sm:p-6 lg:px-8 lg:py-6"
    >
      <div className="relative">
        <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-light)]/90">
          <span className="h-px w-8 bg-[var(--accent)]" />
          <span>{selectedYear === "All Time" ? "全时段档案" : `${selectedYear} 年度档案`}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-3xl">
            <h1
              id="dashboard-title"
              className="font-display text-3xl font-bold leading-none text-white sm:text-4xl lg:text-5xl"
            >
              媒体全景
            </h1>
            <p className="mt-2 max-w-xl text-xs leading-5 text-fg-secondary sm:mt-2.5 sm:text-sm sm:leading-6">
              收录我倾注在光影、声音与文字里的时光。
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-white/10 pt-4 sm:grid-cols-3 lg:min-w-[28rem] lg:grid-cols-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            {totals.map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs tracking-wide text-fg-secondary">{stat.label}</dt>
                <dd
                  className={`mt-1 font-mono text-2xl font-normal tracking-tight sm:text-3xl ${
                    stat.accent ? "text-[var(--accent-light)]" : "text-white"
                  }`}
                >
                  <AnimatedNumber value={Number.isFinite(stat.value) ? stat.value : 0} />
                  {stat.accent ? "%" : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="relative mt-5 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-4 md:flex-row md:items-center">
        {/* 手机横向滚动，避免五标签挤压换行；滑块按当前标签的 offset 对齐。 */}
        <div
          ref={tablistRef}
          className="relative max-w-full overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="仪表板视图"
          onKeyDown={onTabListKeyDown}
        >
          <div className="relative flex w-max min-w-full items-center rounded-full bg-black/25 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1 bottom-1 left-0 rounded-full bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_14px_rgba(0,0,0,0.25)] transition-[transform,width] duration-300 ease-out"
              style={{
                width: indicator.width || 0,
                transform: `translateX(${indicator.left}px)`,
              }}
            />

            {tabs.map((tab) => {
              const selected = activeTab === tab;
              return (
                <button
                  key={tab}
                  ref={(node) => {
                    tabRefs.current[tab] = node;
                  }}
                  type="button"
                  onClick={() => onSelectTab(tab)}
                  role="tab"
                  id={`dashboard-tab-${tabIds[tab]}`}
                  aria-controls={`dashboard-panel-${tabIds[tab]}`}
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  className={`relative z-10 shrink-0 whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                    selected ? "text-white font-bold" : "text-fg-secondary hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        <DashboardYearPicker years={years} selectedYear={selectedYear} onSelect={onSelectYear} />
      </div>
    </section>
  );
}
