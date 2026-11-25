"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import ContinueListeningRail, { type ContinueListeningCard } from "@/components/ContinueListeningRail";
import ContinueWatchingRail, { type ContinueWatchingCard } from "@/components/ContinueWatchingRail";
import CurrentlyReadingRail, { type CurrentlyReadingCard } from "@/components/CurrentlyReadingRail";
import UpcomingHero from "@/components/UpcomingHero";
import DashboardIntro from "@/components/dashboard/DashboardIntro";
import DashboardPanels from "@/components/dashboard/DashboardPanels";
import { deriveDashboardStats } from "@/components/dashboard/dashboard-stats";
import {
  TABS,
  TAB_IDS,
  type DashboardTab,
  getServerUrlSnapshot,
  getUrlSnapshot,
  subscribeToUrl,
  writeDashboardParams,
} from "@/components/dashboard/dashboard-url";
import { TAB_TOP_MEDIA_TYPES, topMediaCacheKey, type TopMediaType } from "@/components/dashboard/top-media-fetch";
import type { MediaCard, MediaDistributions, Summary, UpcomingRelease } from "@/lib/types";
import { pickUpcoming, sgtDateKey } from "@/lib/upcoming";

// 与 UpcomingHero 的轮播上限一致，用来判断展台是否真的会渲染。
const UPCOMING_HERO_MAX_ITEMS = 10;

const TOP_MEDIA_ERROR_MESSAGE = "年度精选暂时无法加载，请稍后重试。";

/** 每分钟与可见性变化时刷新新加坡日期，与展台跨午夜行为对齐。 */
function subscribeToToday(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
}

/** 根据年份和总览、电影、电视节目、音乐、图书标签组织统计、分布及榜单；按当前标签按需加载年度榜单。 */
export default function HomeDashboard({
  summary,
  topMovies,
  topSeries,
  topAlbums,
  topBooks,
  distributions,
  upcoming = [],
  continueWatching = [],
  continueListening = [],
  currentlyReading = [],
  renderedOn,
}: {
  summary: Summary[];
  topMovies: MediaCard[];
  topSeries: MediaCard[];
  topAlbums: MediaCard[];
  topBooks: MediaCard[];
  distributions: MediaDistributions;
  upcoming?: UpcomingRelease[];
  continueWatching?: readonly ContinueWatchingCard[];
  continueListening?: readonly ContinueListeningCard[];
  currentlyReading?: readonly CurrentlyReadingCard[];
  renderedOn?: string;
}) {
  const tabs = TABS;
  const tabIds = TAB_IDS;
  const today = useSyncExternalStore(subscribeToToday, sgtDateKey, () => renderedOn ?? sgtDateKey());

  // 从查询串派生当前视图与年份；无效值回退为总览与全时段。
  const searchParams = new URLSearchParams(useSyncExternalStore(subscribeToUrl, getUrlSnapshot, getServerUrlSnapshot));
  const activeTab: DashboardTab = tabs.find((tab) => tabIds[tab] === searchParams.get("view")) ?? "总览";
  const yearParam = searchParams.get("year");
  const selectedYear =
    yearParam && summary.some((item) => String(item.release_year) === yearParam) ? yearParam : "All Time";

  /** 切换看板标签并同步到 URL。 */
  const setActiveTab = (tab: DashboardTab) => writeDashboardParams(tabIds[tab], selectedYear);
  /** 切换统计年份并同步到 URL。 */
  const setSelectedYear = (year: string) => writeDashboardParams(tabIds[activeTab], year);

  // 已拉取的 (year, type) 结果；切回已见组合时直接复用，不重复请求。
  const [topMediaCache, setTopMediaCache] = useState<Partial<Record<string, MediaCard[]>>>({});
  const cacheRef = useRef(topMediaCache);

  // 错误同样按 (year, type) 键存，避免某年失败污染其它年份的缓存命中视图。
  const [topMediaErrors, setTopMediaErrors] = useState<Partial<Record<string, string>>>({});
  const [topMediaLoadingByType, setTopMediaLoadingByType] = useState<Partial<Record<TopMediaType, boolean>>>({});
  const requestIdRef = useRef(0);
  const selectedYearRef = useRef(selectedYear);

  const stats = deriveDashboardStats(summary, selectedYear, distributions);

  // 供拉取 effect 读取最新缓存，避免把 cache 放进依赖导致进行中的请求被中途取消。
  useEffect(() => {
    cacheRef.current = topMediaCache;
  }, [topMediaCache]);

  useEffect(() => {
    selectedYearRef.current = selectedYear;
  }, [selectedYear]);

  useEffect(
    /* 按当前标签按需拉取年度精选；独立处理各类型成败，并忽略过期响应。 */ () => {
      if (selectedYear === "All Time") {
        return;
      }

      const needed = TAB_TOP_MEDIA_TYPES[activeTab];
      const toFetch = needed.filter((type) => cacheRef.current[topMediaCacheKey(selectedYear, type)] === undefined);
      if (toFetch.length === 0) {
        return;
      }

      const controller = new AbortController();
      const requestId = ++requestIdRef.current;

      /** 判断当前请求是否仍对应当前年份／标签视图。 */
      const isCurrent = () => !controller.signal.aborted && requestId === requestIdRef.current;

      setTopMediaLoadingByType((prev) => {
        const next = { ...prev };
        for (const type of toFetch) next[type] = true;
        return next;
      });
      setTopMediaErrors((prev) => {
        const next = { ...prev };
        for (const type of toFetch) delete next[topMediaCacheKey(selectedYear, type)];
        return next;
      });

      /** 并行拉取缺口类型；单一失败只写入该类型错误，不清空其它类型缓存。 */
      const loadTypes = async () => {
        await Promise.allSettled(
          toFetch.map(async (type) => {
            const key = topMediaCacheKey(selectedYear, type);
            try {
              const response = await fetch(`/api/top-media?type=${type}&year=${encodeURIComponent(selectedYear)}`, {
                signal: controller.signal,
              });
              if (!response.ok) {
                throw new Error("Failed to load top media");
              }
              const items = (await response.json()) as MediaCard[];
              if (!isCurrent()) return;
              setTopMediaCache((prev) => ({ ...prev, [key]: items }));
            } catch (error) {
              if ((error as Error).name === "AbortError") return;
              if (!isCurrent()) return;
              console.error(error);
              setTopMediaErrors((prev) => ({ ...prev, [key]: TOP_MEDIA_ERROR_MESSAGE }));
            } finally {
              if (isCurrent()) {
                setTopMediaLoadingByType((prev) => ({ ...prev, [type]: false }));
              }
            }
          }),
        );
      };

      void loadTypes();
      return /* 取消当前年份／标签尚未完成的榜单请求，并复位其加载标记。 */ () => {
        controller.abort();
        setTopMediaLoadingByType((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const type of toFetch) {
            if (next[type]) {
              next[type] = false;
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      };
    },
    [selectedYear, activeTab],
  );

  /** 仅重试指定类型，不触发整表 effect，以免中止同标签其它进行中的请求。 */
  const retryTopMedia = (type: TopMediaType) => {
    if (selectedYear === "All Time") return;
    const year = selectedYear;
    const key = topMediaCacheKey(year, type);
    setTopMediaCache((prev) => {
      if (prev[key] === undefined) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setTopMediaErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setTopMediaLoadingByType((prev) => ({ ...prev, [type]: true }));

    void (async () => {
      try {
        const response = await fetch(`/api/top-media?type=${type}&year=${encodeURIComponent(year)}`);
        if (!response.ok) {
          throw new Error("Failed to load top media");
        }
        const items = (await response.json()) as MediaCard[];
        if (selectedYearRef.current !== year) return;
        setTopMediaCache((prev) => ({ ...prev, [key]: items }));
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        if (selectedYearRef.current !== year) return;
        console.error(error);
        setTopMediaErrors((prev) => ({ ...prev, [key]: TOP_MEDIA_ERROR_MESSAGE }));
      } finally {
        if (selectedYearRef.current === year) {
          setTopMediaLoadingByType((prev) => ({ ...prev, [type]: false }));
        }
      }
    })();
  };

  const displayedTopMovies = topMediaCache[topMediaCacheKey(selectedYear, "movie")] ?? [];
  const displayedTopSeries = topMediaCache[topMediaCacheKey(selectedYear, "tv_show")] ?? [];
  const displayedTopAlbums = topMediaCache[topMediaCacheKey(selectedYear, "album")] ?? [];
  const displayedTopBooks = topMediaCache[topMediaCacheKey(selectedYear, "book")] ?? [];

  // 请求中途切回全时段时，被取消的请求不会复位加载状态，因此只在选定年份时采用该状态。
  const activeTypes = selectedYear === "All Time" ? [] : TAB_TOP_MEDIA_TYPES[activeTab];
  const isTopMediaLoading = selectedYear !== "All Time" && activeTypes.some((type) => topMediaLoadingByType[type]);
  const visibleErrors: Partial<Record<TopMediaType, string>> =
    selectedYear === "All Time"
      ? {}
      : Object.fromEntries(
          activeTypes
            .map((type) => [type, topMediaErrors[topMediaCacheKey(selectedYear, type)]] as const)
            .filter((entry): entry is readonly [TopMediaType, string] => Boolean(entry[1])),
        );

  // 放映单固定先倒计时、再在看、再在听、再在读。没有内容的那一块返回 null，这里不包额外节点，避免空区块撑出间距。
  // 倒计时展台全幅铺开，需跳出内容栏；其余区块仍落在 max-w-7xl 容器里。
  const continueWatchingRail = <ContinueWatchingRail items={continueWatching} />;
  const continueListeningRail = <ContinueListeningRail items={continueListening} />;
  const currentlyReadingRail = <CurrentlyReadingRail items={currentlyReading} />;
  const upcomingHero = <UpcomingHero items={upcoming} renderedOn={renderedOn} />;
  // 展台会对过期条目再过滤；不能用 raw length，否则隐藏展台后内容会顶到固定导航栏下。
  const hasUpcomingLead = pickUpcoming(upcoming, today, UPCOMING_HERO_MAX_ITEMS).length > 0;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {upcomingHero}
      <div
        className={`container mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-8 sm:gap-5 sm:px-6 md:pb-12 lg:px-8 ${hasUpcomingLead ? "pt-2 sm:pt-3" : "pt-20 sm:pt-22 lg:pt-24"}`}
      >
        {continueWatchingRail}
        {continueListeningRail}
        {currentlyReadingRail}

        <DashboardIntro
          selectedYear={selectedYear}
          totalMovies={stats.totalMovies}
          totalSeries={stats.totalSeries}
          totalAlbums={stats.totalAlbums}
          totalBooks={stats.totalBooks}
          runtimePercent={stats.runtimePercent}
          tabs={tabs}
          tabIds={tabIds}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          years={summary.map(/* 提取统计行的年份，供年份选择器使用。 */ (item) => item.release_year)}
          onSelectYear={setSelectedYear}
        />

        <DashboardPanels
          stats={stats}
          activeTab={activeTab}
          selectedYear={selectedYear}
          topMediaErrors={visibleErrors}
          isTopMediaLoading={isTopMediaLoading}
          topMediaLoadingByType={topMediaLoadingByType}
          onRetryTopMedia={retryTopMedia}
          topMovies={topMovies}
          displayedTopMovies={displayedTopMovies}
          topSeries={topSeries}
          displayedTopSeries={displayedTopSeries}
          topAlbums={topAlbums}
          displayedTopAlbums={displayedTopAlbums}
          topBooks={topBooks}
          displayedTopBooks={displayedTopBooks}
        />
      </div>
    </div>
  );
}
