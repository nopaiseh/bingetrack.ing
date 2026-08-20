"use client";
import MediaRow from "@/components/MediaRow";
import { Media } from "@/lib/types/Media";
import { Summary } from "@/lib/types/media-summary";
import { useState, useRef, useEffect } from "react";

// 接收服务端传入的 topMovies / topSeries，避免在客户端重复查询
export default function HomeDashboard({ summary, topMovies, topSeries }: { summary: Summary[]; topMovies: Media[]; topSeries: Media[] }) {
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
  const moviesPercent = Math.min(
    Math.round((watchedMovies / totalMovies) * 100),
    100,
  );

  const avgMoviesRating = currentYearData?.movie_avg_rating || 0;
  const avgMoviesRatingPercent = Math.min(
    Math.round((avgMoviesRating / 10) * 100),
    100,
  );

  const watchedSeries = currentYearData?.watched_series || 0;
  const totalSeries = currentYearData?.total_series || 1;
  const seriesPercent = Math.min(
    Math.round((watchedSeries / totalSeries) * 100),
    100,
  );

  const avgSeriesRating = currentYearData?.series_avg_rating || 0;
  const avgSeriesRatingPercent = Math.min(
    Math.round((avgSeriesRating / 10) * 100),
    100,
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
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
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === tab ? "bg-white/10 text-white shadow-sm ring-1 ring-white/5" : "text-neutral-400 hover:text-white hover:bg-white/5"}`}
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
                className={`fas fa-chevron-down text-xs text-neutral-500 transition-transform duration-300 ${isDropdownOpen ? "rotate-180" : ""}`}
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
                          selectedYear === year
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
          <div
            key="overview"
            className="animate-fade-in flex flex-col gap-4 md:gap-6"
          >
            
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
                      {Math.round(
                        (currentYearData?.total_watched_runtime ?? 0) / 60,
                      )}
                    </span>
                    <span className="text-neutral-500 font-medium">小时</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 mt-4 border-t border-white/5 pt-4">
                  相当于连续不眠不休看了约{" "}
                  {Math.round(
                    (currentYearData?.total_watched_runtime ?? 0) / 60 / 24,
                  )}{" "}
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
                      {Math.round(
                        (currentYearData?.total_unwatched_runtime ?? 0) / 60,
                      )}
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
                          (currentYearData?.total_runtime ?? 0)) *
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
                      width: `${Math.round(((currentYearData?.total_watched_runtime ?? 0) / (currentYearData?.total_runtime ?? 0)) * 100)}%`,
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
                    {Math.round(
                      (currentYearData?.movies_watched_runtime ?? 0) / 60,
                    )}
                    <span className="text-sm text-neutral-500 font-normal">
                      {" "}
                      /{" "}
                      {Math.round(
                        (currentYearData?.total_movies_runtime ?? 0) / 60,
                      )}{" "}
                      小时
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
                    {Math.round(
                      (currentYearData?.series_watched_runtime ?? 0) / 60,
                    )}
                    <span className="text-sm text-neutral-500 font-normal">
                      {" "}
                      /{" "}
                      {Math.round(
                        (currentYearData?.total_series_runtime ?? 0) / 60,
                      )}{" "}
                      小时
                    </span>
                  </div>
                </div>
              </div>

              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-2">
                
                <div className="bg-black/20 border border-white/5 rounded-xl p-5 flex flex-col gap-4 transition-all duration-300 hover:bg-white/5 hover:border-red-500/30">
                  <div className="text-neutral-400 font-bold text-sm flex items-center gap-2 border-b border-white/5 pb-2">
                    <i className="fas fa-check-circle" /> 已看过
                  </div>
                  <div className="flex flex-col gap-3 mt-1">
                    <div className="flex justify-between items-end">
                      <span className="text-sm text-neutral-400">剧数</span>
                      <span className="text-2xl font-mono text-white">
                        {currentYearData?.watched_series ?? 0}{" "}
                        <span className="text-xs text-neutral-500 font-normal">
                          部
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-sm text-neutral-400">季数</span>
                      <span className="text-2xl font-mono text-white">
                        {currentYearData?.watched_seasons ?? 0}{" "}
                        <span className="text-xs text-neutral-500 font-normal">
                          季
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-sm text-neutral-400">集数</span>
                      <span className="text-2xl font-mono text-white">
                        {currentYearData?.watched_series_episodes ?? 0}{" "}
                        <span className="text-xs text-neutral-500 font-normal">
                          集
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                
                <div className="bg-black/20 border border-white/5 rounded-xl p-5 flex flex-col gap-4 transition-all duration-300 hover:bg-white/5 hover:border-red-500/30">
                  <div className="text-neutral-400 font-bold text-sm flex items-center gap-2 border-b border-white/5 pb-2">
                    <i className="fas fa-play-circle" /> 正在看
                  </div>
                  <div className="flex flex-col gap-3 mt-1">
                    <div className="flex justify-between items-end">
                      <span className="text-sm text-neutral-400">剧数</span>
                      <span className="text-2xl font-mono text-white">
                        {currentYearData?.watching_series ?? 0}{" "}
                        <span className="text-xs text-neutral-500 font-normal">
                          部
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-sm text-neutral-400">季数</span>
                      <span className="text-2xl font-mono text-white">
                        {currentYearData?.watching_seasons ?? 0}{" "}
                        <span className="text-xs text-neutral-500 font-normal">
                          季
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-sm text-neutral-400">集数</span>
                      <span className="text-2xl font-mono text-white">
                        {0}{" "}
                        <span className="text-xs text-neutral-500 font-normal">
                          集
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                
                <div className="bg-black/20 border border-white/5 rounded-xl p-5 flex flex-col gap-4 transition-all duration-300 hover:bg-white/5 hover:border-red-500/30">
                  <div className="text-neutral-400 font-bold text-sm flex items-center gap-2 border-b border-white/5 pb-2">
                    <i className="fas fa-pause-circle" /> 想要看
                  </div>
                  <div className="flex flex-col gap-3 mt-1">
                    <div className="flex justify-between items-end">
                      <span className="text-sm text-neutral-400">剧数</span>
                      <span className="text-2xl font-mono text-white">
                        {currentYearData?.unwatched_series ?? 0}{" "}
                        <span className="text-xs text-neutral-500 font-normal">
                          部
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-sm text-neutral-400">季数</span>
                      <span className="text-2xl font-mono text-white">
                        {currentYearData?.unwatched_seasons ?? 0}{" "}
                        <span className="text-xs text-neutral-500 font-normal">
                          季
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-sm text-neutral-400">集数</span>
                      <span className="text-2xl font-mono text-white">
                        {currentYearData?.unwatched_episodes ?? 0}{" "}
                        <span className="text-xs text-neutral-500 font-normal">
                          集
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "电影" && (
          <div
            key="movies"
            className="animate-fade-in flex flex-col gap-4 md:gap-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
              
              <div className="col-span-1 md:col-span-3 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div className="text-neutral-500 mb-4 flex justify-between items-center">
                  <i className="text-xl">{selectedYear}上映的电影，我看了</i>
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-mono text-white">
                      {currentYearData?.watched_movies}
                    </span>
                    <span className="text-sm text-neutral-400">
                      / {currentYearData?.total_movies} 部电影
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)] rounded-full"
                      style={{
                        width: `${moviesPercent}%`,
                        transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-1 md:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div className="text-neutral-500 mb-4 flex justify-between items-center">
                  <i className="text-xl">平均电影评分</i>
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-mono text-white">
                      {currentYearData?.movie_avg_rating || 0}
                    </span>
                    <span className="text-sm text-neutral-500">/ 10</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)] rounded-full"
                      style={{
                        width: `${avgMoviesRatingPercent}%`,
                        transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div className="text-sm text-neutral-400 mb-4 flex items-center gap-2">
                  <div className="flex items-center gap-3 text-sm text-neutral-400 mb-5">
                    <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/10 group-hover:text-red-400 transition-colors duration-300">
                      <i className="fas fa-globe-asia text-sm" />
                    </div>
                    <span className="font-medium tracking-wide">
                      影视产地分布 Top 5
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🇺🇸 美国</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[40%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      40%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🇨🇳 中国</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[25%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      25%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🇯🇵 日本</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[15%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      15%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🇰🇷 韩国</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[12%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      12%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🇬🇧 英国</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[8%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      8%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div className="text-sm text-neutral-400 mb-4 flex items-center gap-2">
                  <div className="flex items-center gap-3 text-sm text-neutral-400 mb-5">
                    <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/10 group-hover:text-red-400 transition-colors duration-300">
                      <i className="fas fa-language text-sm" />
                    </div>
                    <span className="font-medium tracking-wide">
                      主要语言 Top 5
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🗣️ 英语</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[45%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      45%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🗣️ 中文</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[25%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      25%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🗣️ 日语</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[15%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      15%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🗣️ 韩语</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[10%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      10%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🗣️ 法语</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[5%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      5%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div className="text-sm text-neutral-400 mb-4 flex items-center gap-2">
                  <div className="flex items-center gap-3 text-sm text-neutral-400 mb-5">
                    <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/10 group-hover:text-red-400 transition-colors duration-300">
                      <i className="fas fa-ellipsis text-sm"></i>
                    </div>
                    <span className="font-medium tracking-wide">
                      主要类型 Top 5
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">💥 动作</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[35%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      35%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">👽 科幻</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[25%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      25%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">😂 喜剧</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[20%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      20%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🎭 剧情</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[12%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      12%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">👻 恐怖</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[8%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      8%
                    </span>
                  </div>
                </div>
              </div>
            </div>

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
          <div
            key="tv-series"
            className="animate-fade-in flex flex-col gap-4 md:gap-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
              
              <div className="col-span-1 md:col-span-3 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div className="text-neutral-500 mb-4 flex justify-between items-center">
                  <i className="text-xl">{selectedYear}上映的电视剧，我看了</i>
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-mono text-white">
                      {currentYearData?.watched_series}
                    </span>
                    <span className="text-sm text-neutral-400">
                      / {currentYearData?.total_series} 部电视剧
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)] rounded-full"
                      style={{
                        width: `${seriesPercent}%`,
                        transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-1 md:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div className="text-neutral-500 mb-4 flex justify-between items-center">
                  <i className="text-xl">平均电视剧评分</i>
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-mono text-white">
                      {currentYearData?.series_avg_rating || 0}
                    </span>
                    <span className="text-sm text-neutral-500">/ 10</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)] rounded-full"
                      style={{
                        width: `${avgSeriesRatingPercent}%`,
                        transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div className="text-sm text-neutral-400 mb-4 flex items-center gap-2">
                  <div className="flex items-center gap-3 text-sm text-neutral-400 mb-5">
                    <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/10 group-hover:text-red-400 transition-colors duration-300">
                      <i className="fas fa-globe-asia text-sm"></i>
                    </div>
                    <span className="font-medium tracking-wide">
                      影视产地分布 Top 5
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🇺🇸 美国</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[40%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      40%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🇨🇳 中国</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[25%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      25%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🇯🇵 日本</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[15%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      15%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🇰🇷 韩国</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[12%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      12%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🇬🇧 英国</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[8%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      8%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div className="text-sm text-neutral-400 mb-4 flex items-center gap-2">
                  <div className="flex items-center gap-3 text-sm text-neutral-400 mb-5">
                    <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/10 group-hover:text-red-400 transition-colors duration-300">
                      <i className="fas fa-language text-sm"></i>
                    </div>
                    <span className="font-medium tracking-wide">
                      主要语言 Top 5
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🗣️ 英语</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[45%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      45%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🗣️ 中文</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[25%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      25%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🗣️ 日语</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[15%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      15%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🗣️ 韩语</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[10%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      10%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🗣️ 法语</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[5%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      5%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div className="text-sm text-neutral-400 mb-4 flex items-center gap-2">
                  <div className="flex items-center gap-3 text-sm text-neutral-400 mb-5">
                    <div className="bg-white/10 p-2 rounded-lg flex items-center justify-center group-hover:bg-red-500/10 group-hover:text-red-400 transition-colors duration-300">
                      <i className="fas fa-ellipsis text-sm"></i>
                    </div>
                    <span className="font-medium tracking-wide">
                      主要类型 Top 5
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">💥 动作</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[35%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      35%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">👽 科幻</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[25%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      25%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">😂 喜剧</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[20%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      20%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🎭 剧情</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[12%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      12%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">👻 恐怖</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[8%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">
                      8%
                    </span>
                  </div>
                </div>
              </div>
            </div>

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
