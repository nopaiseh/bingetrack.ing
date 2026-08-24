"use client";

import { useState, useRef, useEffect } from "react";
import MediaRow from "@/components/MediaRow";
import { Media, Summary } from "@/lib/types";

interface DistributionItem {
  name: string;
  percent: number;
}

const REGION_TOP5: DistributionItem[] = [
  { name: "🇺🇸 美国", percent: 40 },
  { name: "🇨🇳 中国", percent: 25 },
  { name: "🇯🇵 日本", percent: 15 },
  { name: "🇰🇷 韩国", percent: 12 },
  { name: "🇬🇧 英国", percent: 8 },
];

const LANGUAGE_TOP5: DistributionItem[] = [
  { name: "🗣️ 英语", percent: 45 },
  { name: "🗣️ 中文", percent: 25 },
  { name: "🗣️ 日语", percent: 15 },
  { name: "🗣️ 韩语", percent: 10 },
  { name: "🗣️ 法语", percent: 5 },
];

const GENRE_TOP5: DistributionItem[] = [
  { name: "💥 动作", percent: 35 },
  { name: "👽 科幻", percent: 25 },
  { name: "😂 喜剧", percent: 20 },
  { name: "🎭 剧情", percent: 12 },
  { name: "👻 恐怖", percent: 8 },
];

function DistributionCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon: string;
  items: DistributionItem[];
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
      <div className="text-sm text-neutral-400 mb-4 flex items-center gap-2">
        <div className="flex items-center gap-3 text-sm text-neutral-400 mb-5">
          <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/10 group-hover:text-red-400 transition-colors duration-300">
            <i className={`fas ${icon} text-sm`} />
          </div>
          <span className="font-medium tracking-wide">{title}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.name} className="flex items-center gap-3">
            <span className="text-sm w-14">{item.name}</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-neutral-300" style={{ width: `${item.percent}%` }} />
            </div>
            <span className="text-xs text-neutral-500 w-8 text-right">{item.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionTop5Cards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
      <DistributionCard title="影视产地分布 Top 5" icon="fa-globe-asia" items={REGION_TOP5} />
      <DistributionCard title="主要语言 Top 5" icon="fa-language" items={LANGUAGE_TOP5} />
      <DistributionCard title="主要类型 Top 5" icon="fa-ellipsis" items={GENRE_TOP5} />
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
      <div className="col-span-1 md:col-span-3 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
        <div className="text-neutral-500 mb-4 flex justify-between items-center">
          <i className="text-xl">{year}上映的{categoryName}，我看了</i>
        </div>
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-mono text-white">{watchedCount}</span>
            <span className="text-sm text-neutral-400">
              / {totalCount} 部{categoryName}
            </span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)] rounded-full"
              style={{
                width: `${watchedPercent}%`,
                transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
        </div>
      </div>

      <div className="col-span-1 md:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
        <div className="text-neutral-500 mb-4 flex justify-between items-center">
          <i className="text-xl">平均{categoryName}评分</i>
        </div>
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-mono text-white">{avgRating || 0}</span>
            <span className="text-sm text-neutral-500">/ 10</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)] rounded-full"
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

function SeriesStatusCard({
  title,
  icon,
  seriesCount,
  seasonsCount,
  episodesCount,
}: {
  title: string;
  icon: string;
  seriesCount: number;
  seasonsCount: number;
  episodesCount: number;
}) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-xl p-5 flex flex-col gap-4 transition-all duration-300 hover:bg-white/5 hover:border-red-500/30">
      <div className="text-neutral-400 font-bold text-sm flex items-center gap-2 border-b border-white/5 pb-2">
        <i className={`fas ${icon}`} /> {title}
      </div>
      <div className="flex flex-col gap-3 mt-1">
        <div className="flex justify-between items-end">
          <span className="text-sm text-neutral-400">剧数</span>
          <span className="text-2xl font-mono text-white">
            {seriesCount} <span className="text-xs text-neutral-500 font-normal">部</span>
          </span>
        </div>
        <div className="flex justify-between items-end">
          <span className="text-sm text-neutral-400">季数</span>
          <span className="text-2xl font-mono text-white">
            {seasonsCount} <span className="text-xs text-neutral-500 font-normal">季</span>
          </span>
        </div>
        <div className="flex justify-between items-end">
          <span className="text-sm text-neutral-400">集数</span>
          <span className="text-2xl font-mono text-white">
            {episodesCount} <span className="text-xs text-neutral-500 font-normal">集</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function HomeDashboard({
  summary,
  topMovies,
  topSeries,
}: {
  summary: Summary[];
  topMovies: Media[];
  topSeries: Media[];
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

  const watchedMovies = currentYearData?.watched_movies || 0;
  const totalMovies = currentYearData?.total_movies || 1;
  const moviesPercent = Math.min(Math.round((watchedMovies / totalMovies) * 100), 100);

  const avgMoviesRating = currentYearData?.movie_avg_rating || 0;
  const avgMoviesRatingPercent = Math.min(Math.round((avgMoviesRating / 10) * 100), 100);

  const watchedSeries = currentYearData?.watched_series || 0;
  const totalSeries = currentYearData?.total_series || 1;
  const seriesPercent = Math.min(Math.round((watchedSeries / totalSeries) * 100), 100);

  const avgSeriesRating = currentYearData?.series_avg_rating || 0;
  const avgSeriesRatingPercent = Math.min(Math.round((avgSeriesRating / 10) * 100), 100);

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
            <span className="text-transparent bg-clip-text bg-linear-to-r from-red-500 to-red-700">
              {selectedYear}
            </span>
            <span className="text-white">记录回顾</span>
          </h1>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-5">
          <div className="flex gap-1 bg-[#121212] p-1.5 rounded-xl border border-white/10 shadow-inner">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  activeTab === tab
                    ? "bg-white/10 text-white shadow-sm ring-1 ring-white/5"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative" ref={dropdownRef}>
            <div
              onClick={() => setIsDropdownOpen(true)}
              className="flex items-center gap-2 bg-[#121212] border border-white/10 hover:border-white/20 transition-all pl-4 pr-3 py-2.5 rounded-xl cursor-text w-35 group"
            >
              <i className="far fa-calendar-alt text-red-500 group-hover:text-red-400 transition-colors" />
              <input
                type="text"
                value={isDropdownOpen ? searchQuery : selectedYear}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={selectedYear}
                className="bg-transparent w-full text-neutral-300 font-mono text-sm outline-none placeholder:text-neutral-600"
              />
              <i
                className={`fas fa-chevron-down text-xs text-neutral-500 transition-transform duration-300 ${
                  isDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </div>

            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-32 bg-[#141414] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
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
                            ? "bg-red-500/10 text-red-500 font-bold border-l-2 border-red-500"
                            : "text-neutral-400 hover:bg-white/5 hover:text-white border-l-2 border-transparent"
                        }`}
                      >
                        {year}
                      </button>
                    ))
                  ) : (
                    <div className="px-5 py-4 text-sm font-mono text-neutral-500 text-center">
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
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div>
                  <div className="text-sm text-neutral-400 mb-2 flex items-center gap-2">
                    <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/10 group-hover:text-red-400 transition-colors duration-300">
                      <i className="fas fa-play-circle text-sm" />
                    </div>
                    <span className="text-sm font-bold text-neutral-300 tracking-wide">
                      沉浸总时长
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-5xl font-mono text-white tracking-tighter">
                      {Math.round((currentYearData?.total_watched_runtime ?? 0) / 60)}
                    </span>
                    <span className="text-neutral-500 font-medium">小时</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 mt-4 border-t border-white/5 pt-4">
                  相当于连续不眠不休看了约{" "}
                  {Math.round((currentYearData?.total_watched_runtime ?? 0) / 60 / 24)}{" "}
                  天
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div>
                  <div className="text-sm text-neutral-400 mb-2 flex items-center gap-2">
                    <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/10 group-hover:text-red-400 transition-colors duration-300">
                      <i className="fas fa-layer-group text-sm"></i>
                    </div>
                    <span className="text-sm font-bold text-neutral-300 tracking-wide">
                      片库待看时长
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-5xl font-mono text-neutral-300 tracking-tighter">
                      {Math.round((currentYearData?.total_unwatched_runtime ?? 0) / 60)}
                    </span>
                    <span className="text-neutral-500 font-medium">小时</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 mt-4 border-t border-white/5 pt-4">
                  数据库中尚未消化的总精神食粮
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div>
                  <div className="text-sm text-neutral-400 mb-2 flex items-center gap-2">
                    <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/10 group-hover:text-red-400 transition-colors duration-300">
                      <i className="fas fa-chart-pie text-sm" />
                    </div>
                    <span className="text-sm font-bold text-neutral-300 tracking-wide">
                      片库完成进度
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-5xl font-mono text-white tracking-tighter">
                      {Math.round(
                        ((currentYearData?.total_watched_runtime ?? 0) /
                          (currentYearData?.total_runtime ?? 1)) *
                          100,
                      )}
                      %
                    </span>
                    <span className="text-neutral-500 font-medium">已完成</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)] rounded-full"
                    style={{
                      width: `${Math.round(((currentYearData?.total_watched_runtime ?? 0) / (currentYearData?.total_runtime ?? 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
              <div className="flex items-center border-b border-white/5 pb-3 gap-2">
                <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/10 group-hover:text-red-400 transition-colors duration-300">
                  <i className="fas fa-film text-sm" />
                </div>
                <span className="text-sm font-bold text-neutral-300 tracking-wide">
                  电影看板
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">时长</div>
                  <div className="text-3xl font-mono text-white">
                    {Math.round((currentYearData?.movies_watched_runtime ?? 0) / 60)}
                    <span className="text-sm text-neutral-500 font-normal">
                      {" "}
                      / {Math.round((currentYearData?.total_movies_runtime ?? 0) / 60)} 小时
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">已看总量</div>
                  <div className="text-3xl font-mono text-white">
                    {currentYearData?.watched_movies ?? 0}
                    <span className="text-sm text-neutral-500 font-normal">
                      {" "}
                      / {currentYearData?.total_movies ?? 0} 部
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)] rounded-full"
                  style={{ width: `${moviesPercent}%` }}
                />
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
              <div className="flex items-center border-b border-white/5 pb-3 gap-2">
                <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/10 group-hover:text-red-400 transition-colors duration-300">
                  <i className="fas fa-tv text-sm"></i>
                </div>
                <span className="text-sm font-bold text-neutral-300 tracking-wide">
                  电视剧看板
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">时长</div>
                  <div className="text-3xl font-mono text-white">
                    {Math.round((currentYearData?.series_watched_runtime ?? 0) / 60)}
                    <span className="text-sm text-neutral-500 font-normal">
                      {" "}
                      / {Math.round((currentYearData?.total_series_runtime ?? 0) / 60)} 小时
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-2">
                <SeriesStatusCard
                  title="已看过"
                  icon="fa-check-circle"
                  seriesCount={currentYearData?.watched_series ?? 0}
                  seasonsCount={currentYearData?.watched_seasons ?? 0}
                  episodesCount={currentYearData?.watched_series_episodes ?? 0}
                />
                <SeriesStatusCard
                  title="正在看"
                  icon="fa-play-circle"
                  seriesCount={currentYearData?.watching_series ?? 0}
                  seasonsCount={currentYearData?.watching_seasons ?? 0}
                  episodesCount={0}
                />
                <SeriesStatusCard
                  title="想要看"
                  icon="fa-pause-circle"
                  seriesCount={currentYearData?.unwatched_series ?? 0}
                  seasonsCount={currentYearData?.unwatched_seasons ?? 0}
                  episodesCount={currentYearData?.unwatched_episodes ?? 0}
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
              watchedCount={currentYearData?.watched_movies ?? 0}
              totalCount={currentYearData?.total_movies ?? 0}
              watchedPercent={moviesPercent}
              avgRating={avgMoviesRating}
              avgRatingPercent={avgMoviesRatingPercent}
            />

            <DistributionTop5Cards />

            <div className="space-y-12 mt-4">
              <MediaRow
                title="影史精选"
                items={topMovies}
                viewAllLink={`/movies/watched?year=${selectedYear}`}
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
              watchedCount={currentYearData?.watched_series ?? 0}
              totalCount={currentYearData?.total_series ?? 0}
              watchedPercent={seriesPercent}
              avgRating={avgSeriesRating}
              avgRatingPercent={avgSeriesRatingPercent}
            />

            <DistributionTop5Cards />

            <div className="space-y-12 mt-4">
              <MediaRow
                title="影史精选"
                items={topSeries}
                viewAllLink={`/series/watched?year=${selectedYear}`}
                type="series"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
