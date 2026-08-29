"use client";

import { useState, useRef, useEffect } from "react";
import MediaRow from "@/components/MediaRow";
import { DistributionItem, Media, MediaDistribution, MediaDistributions, Summary } from "@/lib/types";
import {
  CalendarDays,
  ChartPie,
  CheckCircle,
  ChevronDown,
  CircleEllipsis,
  Film,
  Globe2,
  Languages,
  Layers3,
  PauseCircle,
  PlayCircle,
  Tv,
  type LucideIcon,
} from "lucide-react";

function getSearchViewAllLink(type: "电影" | "电视剧", year: string) {
  const params = new URLSearchParams({ type, sort: "rating_desc" });
  if (year !== "All Time") {
    params.set("startYear", year);
    params.set("endYear", year);
  }
  return `/search?${params.toString()}`;
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(Math.round((value / total) * 100), 0), 100);
}

function DistributionCard({ title, icon: Icon, items }: { title: string; icon: LucideIcon; items: DistributionItem[] }) {
  return (
    <div className="glass-card h-full rounded-2xl p-6 transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_15px_40px_rgba(0,0,0,0.3)] group">
      <div className="mb-5 flex h-8 items-center gap-3 text-sm text-neutral-400">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 transition-colors duration-300 shadow-[0_4px_10px_rgba(0,0,0,0.1)] group-hover:bg-red-500/15 group-hover:text-red-400 group-hover:shadow-[0_4px_10px_rgba(248,113,113,0.2)]">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <span className="font-medium tracking-wide text-white/80 transition-colors group-hover:text-white">{title}</span>
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.name} className="flex items-center gap-3">
            <span className="w-20 truncate text-sm text-white/70" title={item.name}>{item.name}</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden shadow-inner">
              <div className="h-full bg-neutral-300/80" style={{ width: `${item.percent}%` }} />
            </div>
            <span className="text-xs text-white/50 w-8 text-right">{item.percent}%</span>
          </div>
        ))}
        {items.length === 0 && <span className="py-6 text-center text-sm text-white/40">暂无数据</span>}
      </div>
    </div>
  );
}

function DistributionTop5Cards({ distribution }: { distribution: MediaDistribution }) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3 md:gap-6">
      <DistributionCard title="影视产地分布 Top 5" icon={Globe2} items={distribution.regions} />
      <DistributionCard title="主要语言 Top 5" icon={Languages} items={distribution.languages} />
      <DistributionCard title="主要类型 Top 5" icon={CircleEllipsis} items={distribution.genres} />
    </div>
  );
}

function CategoryHeaderCards({
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
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
      <div className="col-span-1 md:col-span-3 glass-card rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_15px_40px_rgba(0,0,0,0.3)] group">
        <div className="text-white/60 mb-4 flex justify-between items-center drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">
          <i className="text-xl font-medium">{year} {categoryName} 阅览进度</i>
        </div>
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-mono text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">{watchedCount}</span>
            <span className="text-sm text-white/50 font-medium">
              / {totalCount} 部库藏 (已看 / 总数)
            </span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)] rounded-full"
              style={{
                width: `${watchedPercent}%`,
                transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
        </div>
      </div>

      <div className="col-span-1 md:col-span-1 glass-card rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_15px_40px_rgba(0,0,0,0.3)] group">
        <div className="text-white/60 mb-4 flex justify-between items-center drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">
          <i className="text-xl font-medium">平均{categoryName}评分</i>
        </div>
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-mono text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">{avgRating || 0}</span>
            <span className="text-sm text-white/50 font-medium">/ 10</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)] rounded-full"
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

// Unified Status Card to handle both Movies and Series
function MediaStatusCard({
  title,
  icon: Icon,
  count,
  seasonsCount,
  episodesCount,
}: {
  title: string;
  icon: LucideIcon;
  count: number;
  seasonsCount?: number;
  episodesCount?: number;
}) {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5 flex flex-col gap-4 transition-all duration-300 shadow-[0_4px_15px_rgba(0,0,0,0.1)] hover:bg-white/10 hover:border-red-400/40 hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(248,113,113,0.15)] group">
      <div className="text-white/70 font-bold text-sm flex items-center gap-2 border-b border-white/10 pb-2 group-hover:text-red-300 transition-colors">
        <Icon className="size-4" aria-hidden="true" /> {title}
      </div>
      <div className="flex flex-col gap-3 mt-1">
        <div className="flex justify-between items-end">
          <span className="text-sm text-white/50">部数</span>
          <span className="text-2xl font-mono text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">
            {count} <span className="text-xs text-white/40 font-normal">部</span>
          </span>
        </div>
        {seasonsCount !== undefined && (
          <div className="flex justify-between items-end">
            <span className="text-sm text-white/50">季数</span>
            <span className="text-2xl font-mono text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">
              {seasonsCount} <span className="text-xs text-white/40 font-normal">季</span>
            </span>
          </div>
        )}
        {episodesCount !== undefined && (
          <div className="flex justify-between items-end">
            <span className="text-sm text-white/50">集数</span>
            <span className="text-2xl font-mono text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">
              {episodesCount} <span className="text-xs text-white/40 font-normal">集</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomeDashboard({
  summary,
  topMovies,
  topSeries,
  distributions,
}: {
  summary: Summary[];
  topMovies: Media[];
  topSeries: Media[];
  distributions: MediaDistributions;
}) {
  const [activeTab, setActiveTab] = useState("总览");
  const tabs = ["总览", "电影", "电视剧"];

  const [selectedYear, setSelectedYear] = useState("All Time");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredYears = summary
    .map((item) => item.release_year)
    .filter((release_year) =>
      String(release_year).toLowerCase().includes(searchQuery.toLowerCase()),
    );

  const currentYearData = summary.find(
    (item) => String(item.release_year) === String(selectedYear),
  );
  const movieDistribution = distributions.movies[selectedYear] ?? distributions.movies["All Time"];
  const seriesDistribution = distributions.series[selectedYear] ?? distributions.series["All Time"];

  // Derive movie totals strictly from 2 tracking states (Watched + Unwatched)
  const watchedMovies = currentYearData?.watched_movies || 0;
  const unwatchedMovies = currentYearData?.unwatched_movies || 0;
  const totalMovies = watchedMovies + unwatchedMovies;
  const moviesPercent = percent(watchedMovies, totalMovies);

  const avgMoviesRating = currentYearData?.movie_avg_rating || 0;
  const avgMoviesRatingPercent = percent(avgMoviesRating, 10);

  // Derive series totals strictly from 3 tracking states
  const watchedSeries = currentYearData?.watched_series || 0;
  const watchingSeries = currentYearData?.watching_series || 0;
  const unwatchedSeries = currentYearData?.unwatched_series || 0;
  const totalSeries = watchedSeries + watchingSeries + unwatchedSeries;
  const seriesPercent = percent(watchedSeries, totalSeries);

  const avgSeriesRating = currentYearData?.series_avg_rating || 0;
  const avgSeriesRatingPercent = percent(avgSeriesRating, 10);

  const watchedRuntime = currentYearData?.total_watched_runtime ?? 0;
  const totalRuntime = currentYearData?.total_runtime ?? 0;
  const runtimePercent = percent(watchedRuntime, totalRuntime);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="container mx-auto px-6 md:px-8 max-w-7xl py-12 flex flex-col gap-6 animate-fade-in pt-24">
      <div className="flex flex-col gap-6 md:gap-8 mb-4">
        <div>
          <h1 className="text-4xl md:text-6xl font-mono font-bold tracking-tighter flex items-baseline gap-3">
            <span className="text-transparent bg-clip-text bg-linear-to-r from-red-500 to-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.3)]">
              {selectedYear}
            </span>
            <span className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">记录回顾</span>
          </h1>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-5">
          {/* Frosted Glass Tabs */}
          <div className="flex gap-1 glass-control rounded-xl p-1.5">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  activeTab === tab
                    ? "bg-white/15 text-white shadow-[0_2px_10px_rgba(0,0,0,0.2)] ring-1 ring-white/20 drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative" ref={dropdownRef}>
            {/* Frosted Glass Dropdown Trigger */}
            <div
              onClick={() => setIsDropdownOpen(true)}
              className="glass-control group flex w-35 cursor-text items-center gap-2 rounded-xl py-2.5 pl-4 pr-3 transition-all hover:border-white/20 hover:bg-white/10 hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)]"
            >
              <CalendarDays className="size-4 text-red-500 group-hover:text-red-400 transition-colors group-hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]" aria-hidden="true" />
              <input
                type="text"
                value={isDropdownOpen ? searchQuery : selectedYear}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={selectedYear}
                className="bg-transparent w-full text-white/90 font-mono text-sm outline-none placeholder:text-white/40"
              />
              <ChevronDown
                className={`size-3 text-white/50 transition-transform duration-300 ${
                  isDropdownOpen ? "rotate-180 text-white" : "group-hover:text-white"
                }`}
                aria-hidden="true"
              />
            </div>

            {/* Frosted Glass Dropdown Menu */}
            {isDropdownOpen && (
              <div className="glass-panel absolute right-0 top-full z-50 mt-2 w-32 overflow-hidden rounded-xl animate-in fade-in slide-in-from-top-2">
                <div className="max-h-64 overflow-y-auto custom-scrollbar flex flex-col">
                  {filteredYears.length > 0 ? (
                    filteredYears.map((year) => (
                      <button
                        key={String(year)}
                        onClick={() => {
                          setSelectedYear(String(year));
                          setSearchQuery("");
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-5 py-3 text-sm font-mono transition-colors shrink-0 ${
                          selectedYear === String(year)
                            ? "bg-red-500/15 text-red-400 font-bold border-l-2 border-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.3)]"
                            : "text-white/60 hover:bg-white/10 hover:text-white border-l-2 border-transparent"
                        }`}
                      >
                        {year}
                      </button>
                    ))
                  ) : (
                    <div className="px-5 py-4 text-sm font-mono text-white/50 text-center">
                      无结果
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-full">
        {activeTab === "总览" && (
          <div key="overview" className="animate-fade-in flex flex-col gap-4 md:gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              
              <div className="glass-card rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_15px_40px_rgba(0,0,0,0.3)] group">
                <div>
                  <div className="text-sm text-white/60 mb-2 flex items-center gap-2">
                    <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/15 group-hover:text-red-400 transition-colors duration-300 shadow-[0_4px_10px_rgba(0,0,0,0.1)] group-hover:shadow-[0_4px_10px_rgba(248,113,113,0.2)]">
                      <PlayCircle className="size-4" aria-hidden="true" />
                    </div>
                    <span className="text-sm font-bold text-white/80 group-hover:text-white transition-colors tracking-wide">
                      已看总时长
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-5xl font-mono text-white tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                      {Math.round((currentYearData?.total_watched_runtime ?? 0) / 60)}
                    </span>
                    <span className="text-white/50 font-medium">小时</span>
                  </div>
                </div>
                <p className="text-xs text-white/50 mt-4 border-t border-white/10 pt-4">
                  相当于连续不眠不休看了约 {Math.round((currentYearData?.total_watched_runtime ?? 0) / 60 / 24)} 天
                </p>
              </div>

              <div className="glass-card rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_15px_40px_rgba(0,0,0,0.3)] group">
                <div>
                  <div className="text-sm text-white/60 mb-2 flex items-center gap-2">
                    <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/15 group-hover:text-red-400 transition-colors duration-300 shadow-[0_4px_10px_rgba(0,0,0,0.1)] group-hover:shadow-[0_4px_10px_rgba(248,113,113,0.2)]">
                      <Layers3 className="size-4" aria-hidden="true" />
                    </div>
                    <span className="text-sm font-bold text-white/80 group-hover:text-white transition-colors tracking-wide">
                      待看时长
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-5xl font-mono text-white tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                      {Math.round((currentYearData?.total_unwatched_runtime ?? 0) / 60)}
                    </span>
                    <span className="text-white/50 font-medium">小时</span>
                  </div>
                </div>
                <p className="text-xs text-white/50 mt-4 border-t border-white/10 pt-4">
                  正在看与想要看的精神食粮储备
                </p>
              </div>

              <div className="glass-card rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_15px_40px_rgba(0,0,0,0.3)] group">
                <div>
                  <div className="text-sm text-white/60 mb-2 flex items-center gap-2">
                    <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/15 group-hover:text-red-400 transition-colors duration-300 shadow-[0_4px_10px_rgba(0,0,0,0.1)] group-hover:shadow-[0_4px_10px_rgba(248,113,113,0.2)]">
                      <ChartPie className="size-4" aria-hidden="true" />
                    </div>
                    <span className="text-sm font-bold text-white/80 group-hover:text-white transition-colors tracking-wide">
                      片库完成进度
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-5xl font-mono text-white tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                      {runtimePercent}
                      %
                    </span>
                    <span className="text-white/50 font-medium">已完成</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-2 shadow-inner">
                  <div
                    className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)] rounded-full"
                    style={{
                      width: `${runtimePercent}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Movies Section (Updated to 2 columns) */}
            <div className="glass-card rounded-2xl p-6 flex flex-col gap-6 transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_15px_40px_rgba(0,0,0,0.3)] group">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/15 group-hover:text-red-400 transition-colors duration-300 shadow-[0_4px_10px_rgba(0,0,0,0.1)] group-hover:shadow-[0_4px_10px_rgba(248,113,113,0.2)]">
                    <Film className="size-4" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-bold text-white/80 group-hover:text-white transition-colors tracking-wide">
                    电影看板
                  </span>
                </div>
                <span className="text-xs font-mono text-white/50">
                  总计: {totalMovies} 部
                </span>
              </div>

              {/* Grid set to grid-cols-2 as requested */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <MediaStatusCard
                  title="已看过"
                  icon={CheckCircle}
                  count={watchedMovies}
                />
                <MediaStatusCard
                  title="想要看"
                  icon={PauseCircle}
                  count={unwatchedMovies}
                />
              </div>

              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)] rounded-full"
                  style={{ width: `${moviesPercent}%` }}
                />
              </div>
            </div>

            {/* Series Section */}
            <div className="glass-card rounded-2xl p-6 flex flex-col gap-6 transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_15px_40px_rgba(0,0,0,0.3)] group">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/15 group-hover:text-red-400 transition-colors duration-300 shadow-[0_4px_10px_rgba(0,0,0,0.1)] group-hover:shadow-[0_4px_10px_rgba(248,113,113,0.2)]">
                    <Tv className="size-4" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-bold text-white/80 group-hover:text-white transition-colors tracking-wide">
                    电视剧看板
                  </span>
                </div>
                <span className="text-xs font-mono text-white/50">
                  总计: {totalSeries} 部
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <MediaStatusCard
                  title="已观看"
                  icon={CheckCircle}
                  count={watchedSeries}
                  seasonsCount={currentYearData?.watched_seasons ?? 0}
                  episodesCount={currentYearData?.watched_series_episodes ?? 0}
                />
                <MediaStatusCard
                  title="正在看"
                  icon={PlayCircle}
                  count={watchingSeries}
                  seasonsCount={currentYearData?.watching_seasons ?? 0}
                />
                <MediaStatusCard
                  title="想要看"
                  icon={PauseCircle}
                  count={unwatchedSeries}
                  seasonsCount={currentYearData?.unwatched_seasons ?? 0}
                  episodesCount={currentYearData?.unwatched_episodes ?? 0}
                />
              </div>
              
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)] rounded-full"
                  style={{ width: `${seriesPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "电影" && (
          <div key="movies" className="animate-fade-in flex flex-col gap-4 md:gap-6">
            <CategoryHeaderCards
              year={selectedYear}
              categoryName="电影"
              watchedCount={watchedMovies}
              totalCount={totalMovies}
              watchedPercent={moviesPercent}
              avgRating={avgMoviesRating}
              avgRatingPercent={avgMoviesRatingPercent}
            />

            <DistributionTop5Cards distribution={movieDistribution} />

            <div className="space-y-12 mt-4">
              <MediaRow
                title="影史精选"
                items={topMovies}
                viewAllLink={getSearchViewAllLink("电影", selectedYear)}
                type="movies"
              />
            </div>
          </div>
        )}

        {activeTab === "电视剧" && (
          <div key="tv-series" className="animate-fade-in flex flex-col gap-4 md:gap-6">
            <CategoryHeaderCards
              year={selectedYear}
              categoryName="电视剧"
              watchedCount={watchedSeries}
              totalCount={totalSeries}
              watchedPercent={seriesPercent}
              avgRating={avgSeriesRating}
              avgRatingPercent={avgSeriesRatingPercent}
            />

            <DistributionTop5Cards distribution={seriesDistribution} />

            <div className="space-y-12 mt-4">
              <MediaRow
                title="影史精选"
                items={topSeries}
                viewAllLink={getSearchViewAllLink("电视剧", selectedYear)}
                type="series"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
