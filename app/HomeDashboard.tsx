"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import ContinueWatchingRail, { type ContinueWatchingCard } from "@/components/ContinueWatchingRail";
import UpcomingHero from "@/components/UpcomingHero";
import DashboardIntro from "@/components/dashboard/DashboardIntro";
import DashboardPanels from "@/components/dashboard/DashboardPanels";
import { deriveDashboardStats } from "@/components/dashboard/dashboard-stats";
import { TABS, TAB_IDS, getServerUrlSnapshot, getUrlSnapshot, subscribeToUrl, writeDashboardParams } from "@/components/dashboard/dashboard-url";
import type { MediaCard, MediaDistributions, Summary, UpcomingRelease } from "@/lib/types";

/** 根据年份和总览、电影、电视节目标签组织统计、分布及榜单；年份变化时加载对应榜单。 */
export default function HomeDashboard({
  summary,
  topMovies,
  topSeries,
  distributions,
  upcoming = [],
  continueWatching = [],
  upcomingFirst = false,
  renderedOn,
}: {
  summary: Summary[];
  topMovies: MediaCard[];
  topSeries: MediaCard[];
  distributions: MediaDistributions;
  upcoming?: UpcomingRelease[];
  continueWatching?: readonly ContinueWatchingCard[];
  /** 服务端按新加坡日历计算：今天起 7 天内（含第 7 天）有片上映时为 true。为 true 时即将上映在前，false 或缺省时继续观看在前。 */
  upcomingFirst?: boolean;
  renderedOn?: string;
}) {
  const tabs = TABS;
  const tabIds = TAB_IDS;

  // 从查询串派生当前视图与年份；无效值回退为总览与全时段。
  const searchParams = new URLSearchParams(useSyncExternalStore(subscribeToUrl, getUrlSnapshot, getServerUrlSnapshot));
  const activeTab = tabs.find((tab) => tabIds[tab] === searchParams.get("view")) ?? "总览";
  const yearParam = searchParams.get("year");
  const selectedYear = yearParam && summary.some((item) => String(item.release_year) === yearParam) ? yearParam : "All Time";

  /** 切换看板标签并同步到 URL。 */
  const setActiveTab = (tab: string) => writeDashboardParams(tabIds[tab], selectedYear);
  /** 切换统计年份并同步到 URL。 */
  const setSelectedYear = (year: string) => writeDashboardParams(tabIds[activeTab], year);

  const [displayedTopMovies, setDisplayedTopMovies] = useState(topMovies);
  const [displayedTopSeries, setDisplayedTopSeries] = useState(topSeries);
  const [topMediaError, setTopMediaError] = useState<string | null>(null);
  const [topMediaLoading, setTopMediaLoading] = useState(false);

  const {
    currentYearData,
    movieDistribution,
    seriesDistribution,
    watchedMovies,
    unwatchedMovies,
    totalMovies,
    moviesPercent,
    avgMoviesRating,
    avgMoviesRatingPercent,
    moviesWatchedRuntime,
    moviesUnwatchedRuntime,
    totalMoviesRuntime,
    watchedSeries,
    watchingSeries,
    unwatchedSeries,
    totalSeries,
    seriesPercent,
    watchedEpisodes,
    unwatchedEpisodes,
    totalEpisodes,
    seriesEpisodesPercent,
    avgSeriesRating,
    avgSeriesRatingPercent,
    seriesWatchedRuntime,
    seriesUnwatchedRuntime,
    totalSeriesRuntime,
    runtimePercent,
  } = deriveDashboardStats(summary, selectedYear, distributions);

  useEffect(/* 选择具体年份时启动榜单请求，离开该年份或卸载组件时取消请求。 */ () => {
    if (selectedYear === "All Time") {
      return;
    }

    const controller = new AbortController();
    /** 并行加载该年的电影和电视节目榜单，更新加载状态与结果，并显示非取消类错误。 */
    const loadTopMedia = async () => {
      try {
        setTopMediaError(null);
        setTopMediaLoading(true);
        setDisplayedTopMovies([]);
        setDisplayedTopSeries([]);
        const [moviesResponse, seriesResponse] = await Promise.all([
          fetch(`/api/top-media?type=movie&year=${encodeURIComponent(selectedYear)}`, { signal: controller.signal }),
          fetch(`/api/top-media?type=tv_show&year=${encodeURIComponent(selectedYear)}`, { signal: controller.signal }),
        ]);
        if (!moviesResponse.ok || !seriesResponse.ok) throw new Error("Failed to load top media");
        const [movies, series] = await Promise.all([moviesResponse.json(), seriesResponse.json()]);
        setDisplayedTopMovies(movies);
        setDisplayedTopSeries(series);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error(error);
          setTopMediaError("年度精选暂时无法加载，请稍后重试。");
        }
      } finally {
        if (!controller.signal.aborted) {
          setTopMediaLoading(false);
        }
      }
    };

    void loadTopMedia();
    return /* 取消当前年份尚未完成的榜单请求。 */ () => controller.abort();
  }, [selectedYear]);

  // 请求中途切回全时段时，被取消的请求不会复位加载状态，因此只在选定年份时采用该状态。
  const isTopMediaLoading = topMediaLoading && selectedYear !== "All Time";

  // 用 DOM 顺序切换，不用 CSS order，读屏和键盘 Tab 会跟着变。两个组件各自在没有内容时返回 null，这里不包额外节点，避免空区块撑出间距。
  const continueWatchingRail = <ContinueWatchingRail items={continueWatching} />;
  const upcomingHero = <UpcomingHero items={upcoming} renderedOn={renderedOn} />;

  return (
    <div
      className="container mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-8 pt-20 sm:pt-22 sm:px-6 md:pb-12 lg:pt-24 lg:px-8"
      data-upcoming-first={upcomingFirst ? "true" : "false"}
    >
      {upcomingFirst ? upcomingHero : continueWatchingRail}
      {upcomingFirst ? continueWatchingRail : upcomingHero}

      <DashboardIntro
        selectedYear={selectedYear}
        totalMovies={totalMovies}
        totalSeries={totalSeries}
        runtimePercent={runtimePercent}
        tabs={tabs}
        tabIds={tabIds}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        years={summary.map(/* 提取统计行的年份，供年份选择器使用。 */ (item) => item.release_year)}
        onSelectYear={setSelectedYear}
      />

      <DashboardPanels
        activeTab={activeTab}
        selectedYear={selectedYear}
        topMediaError={topMediaError}
        isTopMediaLoading={isTopMediaLoading}
        watchedMovies={watchedMovies}
        unwatchedMovies={unwatchedMovies}
        totalMovies={totalMovies}
        moviesPercent={moviesPercent}
        avgMoviesRating={avgMoviesRating}
        avgMoviesRatingPercent={avgMoviesRatingPercent}
        moviesWatchedRuntime={moviesWatchedRuntime}
        moviesUnwatchedRuntime={moviesUnwatchedRuntime}
        totalMoviesRuntime={totalMoviesRuntime}
        movieDistribution={movieDistribution}
        topMovies={topMovies}
        displayedTopMovies={displayedTopMovies}
        watchedSeries={watchedSeries}
        watchingSeries={watchingSeries}
        unwatchedSeries={unwatchedSeries}
        watchedEpisodes={watchedEpisodes}
        unwatchedEpisodes={unwatchedEpisodes}
        totalEpisodes={totalEpisodes}
        seriesEpisodesPercent={seriesEpisodesPercent}
        watchedSeasons={currentYearData?.watched_seasons ?? 0}
        watchingSeasons={currentYearData?.watching_seasons ?? 0}
        unwatchedSeasons={currentYearData?.unwatched_seasons ?? 0}
        totalSeries={totalSeries}
        seriesPercent={seriesPercent}
        avgSeriesRating={avgSeriesRating}
        avgSeriesRatingPercent={avgSeriesRatingPercent}
        seriesWatchedRuntime={seriesWatchedRuntime}
        seriesUnwatchedRuntime={seriesUnwatchedRuntime}
        totalSeriesRuntime={totalSeriesRuntime}
        seriesDistribution={seriesDistribution}
        topSeries={topSeries}
        displayedTopSeries={displayedTopSeries}
      />
    </div>
  );
}
