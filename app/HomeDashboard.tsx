"use client";
import MediaRow from "@/components/MediaRow";
import { Media } from "@/lib/types/Media";
import { Summary } from "@/lib/types/Summary";
import { mapSupabaseToMedia, SupabaseMediaItem } from "@/lib/functions/mediaMapper";
import { useState, useRef, useEffect } from "react";
import { getSupabaseBrowser } from "@/utils/supabase-client";

export default function HomeDashboard({ summary }: { summary: Summary[] }) {
  const [activeTab, setActiveTab] = useState("总览");
  const tabs = ["总览", "电影", "电视剧"];

  const [selectedYear, setSelectedYear] = useState(
    "All Time",
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // 前十媒体
  const [topMovies, setTopMovies] = useState<Media[]>([]);
  const [topSeries, setTopSeries] = useState<Media[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);

  const filteredYears = summary
    .map((item) => item.release_year)
    .filter((release_year) =>
      String(release_year).toLowerCase().includes(searchQuery.toLowerCase()),
    );

  const currentYearData = summary.find(
    (item) => String(item.release_year) === String(selectedYear),
  );

  // 电影统计
  const watchedMovies = currentYearData?.watched_movies || 0;
  const totalMovies = currentYearData?.total_movies || 1;
  const moviesPercent = Math.min(
    Math.round((watchedMovies / totalMovies) * 100),
    100
  );

  const avgMoviesRating = currentYearData?.movie_avg_rating || 0;
  const avgMoviesRatingPercent = Math.min(
    Math.round((avgMoviesRating / 10) * 100),
    100
  );

  // 电视剧统计
  const watchedSeries = currentYearData?.watched_series || 0;
  const totalSeries = currentYearData?.total_series || 1;
  const seriesPercent = Math.min(
    Math.round((watchedSeries / totalSeries) * 100),
    100
  );

  const avgSeriesRating = currentYearData?.series_avg_rating || 0;
  const avgSeriesRatingPercent = Math.min(
    Math.round((avgSeriesRating / 10) * 100),
    100
  );

  // 点击外部关闭 Dropdown
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


  // 获取前十电影
  useEffect(() => {
    async function fetchTopMovies() {
      setIsLoadingMedia(true);
      try {
        let query = getSupabaseBrowser()
          .from("media_info")
          .select(
            `id, title, summary, cover_url, release_date, type, status, rating,
            media_genres ( genres ( name ) ),
            media_languages ( languages ( name ) ),
            media_regions ( regions ( name ) ),
            media_credits ( people ( name ), role, credit_order )`
          )
          .eq("type", "movie")
          .order("rating", { ascending: false })
          .limit(10);

        if (selectedYear && selectedYear !== "All Time") {
          query = query
            .gte("release_date", `${selectedYear}-01-01`)
            .lte("release_date", `${selectedYear}-12-31`);
        }

        const { data: topMoviesData, error } = (await query) as {
          data: SupabaseMediaItem[] | null;
          error: unknown;
        };

        if (error) {
          console.error("Supabase query error: ", error);
          return;
        }

        setTopMovies(
          (topMoviesData ?? []).map((item) => mapSupabaseToMedia(item, "movies")) as Media[],
        );
      } catch (error) {
        console.error("Error fetching top movies:", error);
      } finally {
        setIsLoadingMedia(false);
      }
    }

    if (activeTab === "电影") {
      fetchTopMovies();
    }
  }, [selectedYear, activeTab]); // 当 selectedYear 或 activeTab 发生变化时，重新运行

  // 获取前十电视剧
  useEffect(() => {
    async function fetchTopSeries() {
      setIsLoadingMedia(true);
      try {
        let query = getSupabaseBrowser()
          .from("media_info")
          .select(
            `id, title, summary, cover_url, release_date, type, status, rating,
            media_genres ( genres ( name ) ),
            media_languages ( languages ( name ) ),
            media_regions ( regions ( name ) ),
            media_credits ( people ( name ), role, credit_order )`
          )
          .eq("type", "tv_series")
          .order("rating", { ascending: false })
          .limit(10);

        if (selectedYear && selectedYear !== "All Time") {
          query = query
            .gte("release_date", `${selectedYear}-01-01`)
            .lte("release_date", `${selectedYear}-12-31`);
        }

        const { data: topSeriesData, error } = (await query) as {
          data: SupabaseMediaItem[] | null;
          error: unknown;
        };

        if (error) {
          console.error("Supabase query error: ", error);
          return;
        }

        setTopSeries(
          (topSeriesData ?? []).map((item) =>
            mapSupabaseToMedia(item, "series"),
          ) as Media[],
        );
      } catch (error) {
        console.error("Error fetching top series:", error);
      } finally {
        setIsLoadingMedia(false);
      }
    }

    if (activeTab === "电视剧") {
      fetchTopSeries();
    }
  }, [selectedYear, activeTab]); // 当 selectedYear 或 activeTab 发生变化时，重新运行

  return (
    <div className="container mx-auto px-6 md:px-8 max-w-7xl py-12 flex flex-col gap-6 animate-fade-in pt-24">
      {/* 头部控制区 */}
      <div className="flex flex-col gap-6 md:gap-8 mb-4">
        <div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight flex items-baseline gap-3">
            <span className="text-transparent bg-clip-text bg-linear-to-r from-red-500 to-red-700">
              {selectedYear}
            </span>
            <span className="text-white">记录回顾</span>
          </h1>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-5">
          {/* 选项卡 */}
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

          {/* 可搜索的年份 Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <div
              onClick={() => setIsDropdownOpen(true)}
              className="flex items-center gap-2 bg-[#121212] border border-white/10 hover:border-white/20 transition-all pl-4 pr-3 py-2.5 rounded-xl cursor-text w-35 group"
            >
              <i className="far fa-calendar-alt text-red-500 group-hover:text-red-400 transition-colors"></i>

              <input
                type="text"
                value={isDropdownOpen ? searchQuery : selectedYear}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={selectedYear}
                className="bg-transparent w-full text-neutral-300 font-mono text-sm outline-none placeholder:text-neutral-600"
              />
              <i
                className={`fas fa-chevron-down text-xs text-neutral-500 transition-transform duration-300 ${isDropdownOpen ? "rotate-180" : ""}`}
              ></i>
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
          <div key="overview" className="animate-fade-in flex flex-col gap-8 md:gap-12">
            {/* --- 第一层：屏幕沉浸时长 --- */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 hover:bg-white/[0.07] transition-all duration-300 flex flex-col gap-6 relative overflow-hidden group">
              {/* 模块头部 */}
              <div className="flex justify-between items-center border-b border-white/5 pb-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/10">
                    <i className="fas fa-stopwatch text-lg"></i>
                  </div>
                  <h3 className="text-xl font-bold text-white">屏幕沉浸时长</h3>
                </div>
              </div>

              {/* 核心数据区 */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12 items-center relative z-10">
                {/* 左侧：总时长 (在大屏下增加右侧分割线和内边距，让左右分界更高级) */}
                <div className="lg:col-span-1 flex flex-col justify-center lg:border-r lg:border-white/10 lg:pr-8">
                  <div className="text-sm text-neutral-400 mb-2">总计花费</div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-6xl font-black text-white tracking-tighter">
                      {Math.round((currentYearData?.total_runtime ?? 0) / 60)}
                    </span>
                    <span className="text-neutral-500 font-medium">小时</span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    相当于连续不眠不休看了约{" "}
                    {Math.round(
                      (currentYearData?.total_runtime ?? 0) / 60 / 24,
                    )}{" "}
                    天
                  </p>
                </div>

                {/* 右侧：电影 vs 电视剧 对比图表 */}
                <div className="lg:col-span-3 flex flex-col justify-center gap-5">
                  <div className="flex justify-between items-end">
                    {/* 电影数据 (左) */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-red-400 text-sm font-medium flex items-center gap-2">
                        <i className="fas fa-film"></i> 电影
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-5xl font-bold text-white">
                          {Math.round(
                            (currentYearData?.total_movies_runtime ?? 0) / 60,
                          )}
                        </span>
                        <span className="text-xs text-neutral-500">
                          小时 (
                          {Math.round(
                            ((currentYearData?.total_movies_runtime ?? 0) /
                              (currentYearData?.total_runtime ?? 1)) *
                              100,
                          )}
                          %)
                        </span>
                      </div>
                    </div>

                    {/* 电视剧数据 (右) - 修正了文字顺序 */}
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-indigo-400 text-sm font-medium flex items-center gap-2">
                        电视剧 <i className="fas fa-tv"></i>
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-5xl font-bold text-white">
                          {Math.round(
                            (currentYearData?.total_series_runtime ?? 0) / 60,
                          )}
                        </span>
                        <span className="text-xs text-neutral-500">
                          小时 (
                          {Math.round(
                            ((currentYearData?.total_series_runtime ?? 0) /
                              (currentYearData?.total_runtime ?? 1)) *
                              100,
                          )}
                          %)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 堆叠比例条 (Stacked Bar Chart) */}
                  <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden flex border border-white/10 shadow-inner">
                    {/* 电影比例 */}
                    <div
                      className="h-full bg-linear-to-r from-red-600 to-red-400 relative"
                      style={{
                        width: `${Math.round(((currentYearData?.total_movies_runtime ?? 0) / (currentYearData?.total_runtime ?? 1)) * 100)}%`,
                      }}
                    >
                      <div className="absolute inset-0 bg-white/20 w-full h-px"></div>
                    </div>
                    {/* 分割线 */}
                    <div className="w-0.5 h-full bg-[#0a0a0a] z-10"></div>
                    {/* 电视剧比例 */}
                    <div
                      className="h-full bg-linear-to-l from-indigo-600 to-indigo-400 relative"
                      style={{
                        width: `${Math.round(((currentYearData?.total_series_runtime ?? 0) / (currentYearData?.total_runtime ?? 1)) * 100)}%`,
                      }}
                    >
                      <div className="absolute inset-0 bg-white/20 w-full h-px"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* --- 第二层：动态活跃度轨迹 --- */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 hover:bg-white/[0.07] transition-all duration-300">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {selectedYear === "All Time"
                      ? "消费轨迹 (全时段)"
                      : `${selectedYear} 消费轨迹`}
                  </h3>
                  <p className="text-sm text-neutral-500">
                    {selectedYear === "All Time"
                      ? "回顾你历年的精神食粮摄入趋势"
                      : "回顾你这一年中每个月的摄入节奏"}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-neutral-500 mb-1">
                    {selectedYear === "All Time" ? "巅峰年份" : "巅峰月份"}
                  </div>
                  <div className="text-xl font-bold text-white">
                    {selectedYear === "All Time" ? "2025 年" : "8 月"}
                  </div>
                </div>
              </div>

              <div className="h-24 w-full flex items-end justify-between gap-1 md:gap-2">
                {selectedYear === "All Time"
                  ? ["2022", "2023", "2024", "2025", "2026"].map(
                      (year, index) => (
                        <div
                          key={year}
                          className="flex flex-col items-center flex-1 gap-2 group"
                        >
                          <div
                            className={`w-full rounded-t-sm transition-all duration-500 ${index === 3 ? "bg-white/40 h-full" : "bg-white/10 h-1/2 group-hover:bg-white/20"}`}
                          ></div>
                          <span className="text-[10px] text-neutral-500 group-hover:text-white transition-colors">
                            {year}
                          </span>
                        </div>
                      ),
                    )
                  : [
                      "1月",
                      "2月",
                      "3月",
                      "4月",
                      "5月",
                      "6月",
                      "7月",
                      "8月",
                      "9月",
                      "10月",
                      "11月",
                      "12月",
                    ].map((month, index) => (
                      <div
                        key={month}
                        className="flex flex-col items-center flex-1 gap-2 group"
                      >
                        <div
                          className={`w-full rounded-t-sm transition-all duration-500 ${index === 7 ? "bg-white/40 h-full" : "bg-white/10 h-1/3 group-hover:bg-white/20"}`}
                        ></div>
                        <span className="text-[10px] text-neutral-500 hidden sm:block group-hover:text-white transition-colors">
                          {month}
                        </span>
                      </div>
                    ))}
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
              {/* 电影观看记录 */}
              <div className="col-span-1 md:col-span-3 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div className="text-neutral-500 mb-4 flex justify-between items-center">
                  <i className="text-xl">{selectedYear}上映的电影，我看了</i>
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-black text-white">
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
                    ></div>
                  </div>
                </div>
              </div>

              <div className="col-span-1 md:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div className="text-neutral-500 mb-4 flex justify-between items-center">
                  <i className="text-xl">平均电影评分</i>
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-black text-white">
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
                    ></div>
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
              {/* 前十电影 */}
              {isLoadingMedia ? (
                <div className="flex justify-center items-center py-12 text-neutral-500 animate-pulse">
                  <i className="fas fa-circle-notch fa-spin mr-3"></i>
                  正在加载{selectedYear}最佳电影...
                </div>
              ) : (
                <MediaRow
                  title="影史精选"
                  items={topMovies}
                  viewAllLink={`/movies/watched?year=${selectedYear}`}
                  type="movies"
                />
              )}
            </div>
          </div>
        )}

        {/* 电视剧 */}
        {activeTab === "电视剧" && (
          <div
            key="tv-series"
            className="animate-fade-in flex flex-col gap-4 md:gap-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
              {/* 电视剧观看记录 */}
              <div className="col-span-1 md:col-span-3 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div className="text-neutral-500 mb-4 flex justify-between items-center">
                  <i className="text-xl">{selectedYear}上映的电视剧，我看了</i>
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-black text-white">
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
                    ></div>
                  </div>
                </div>
              </div>

              <div className="col-span-1 md:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 group">
                <div className="text-neutral-500 mb-4 flex justify-between items-center">
                  <i className="text-xl">平均电视剧评分</i>
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-black text-white">
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
                    ></div>
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
              {/* 前十电视剧 */}
              {isLoadingMedia ? (
                <div className="flex justify-center items-center py-12 text-neutral-500 animate-pulse">
                  <i className="fas fa-circle-notch fa-spin mr-3"></i>
                  正在加载{selectedYear}最佳电视剧...
                </div>
              ) : (
                <MediaRow
                  title="影史精选"
                  items={topSeries}
                  viewAllLink={`/movies/watched?year=${selectedYear}`}
                  type="series"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}