"use client";

import { Summary } from "@/lib/types/Summary";
import { useState, useRef, useEffect } from "react";

export default function HomeDashboard({ summary }: { summary: Summary[] }) {
  const [activeTab, setActiveTab] = useState("总览");
  const tabs = ["总览", "电影", "电视剧"];

  const today = new Date().toISOString().split("T")[0];

  const [selectedYear, setSelectedYear] = useState(
    today ? today.split("-")[0] : "All Time",
  );
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

  // Movies
  const watchedMovies = currentYearData?.watched_movies || 0;
  const totalMovies = currentYearData?.total_movies || 1;

  const moviesPercent = Math.min(
    Math.round((watchedMovies / totalMovies) * 100),
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
      {/* 头部控制区 */}
      <div className="flex flex-col gap-6 md:gap-8 mb-4">
        <div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight flex items-baseline gap-3">
            <span className="text-transparent bg-clip-text bg-linear-to-r from-red-500 to-red-700">
              {selectedYear}
            </span>
            <span className="text-white">年度回顾</span>
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

          {/* 可搜索的年份 Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <div
              onClick={() => setIsDropdownOpen(true)}
              className="flex items-center gap-2 bg-[#121212] border border-white/10 hover:border-white/20 transition-all pl-4 pr-3 py-2.5 rounded-xl cursor-text w-32 group"
            >
              <i className="far fa-calendar-alt text-red-500 group-hover:text-red-400 transition-colors"></i>

              {/* 动态Input：未打开时显示选中的年份，打开时允许输入 */}
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
          <div key="overview" className="animate-fade-in flex flex-col gap-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <div className="col-span-2 md:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between group">
                <div className="text-neutral-500 mb-4 flex justify-between items-center">
                  <i className="fas fa-list-check text-xl"></i>
                  <span className="text-xs text-neutral-400 bg-white/10 px-2 py-1 rounded-full">
                    完成度 70%
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-black text-white">42</span>
                    <span className="text-sm text-neutral-400">
                      / 60 部计划
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 w-[70%] rounded-full"></div>
                  </div>
                </div>
              </div>

              <div className="col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center">
                <div className="text-sm text-neutral-400 mb-4">
                  影视产地分布
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-12">🇺🇸 美国</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[50%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500">50%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-12">🇯🇵 日本</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[30%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500">30%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "电影" && (
          <div key="movies" className="animate-fade-in flex flex-col gap-4 md:gap-6">
            
            {/* --- 第一行：观影进度 & 平均评分 (4 Columns) --- */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
              <div className="col-span-1 md:col-span-3 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between group">
                <div className="text-neutral-500 mb-4 flex justify-between items-center">
                  <i className="text-xl">这一年上映的电影，我看了</i>
                  <span className="text-xs text-neutral-400 bg-white/10 px-2 py-1 rounded-full">
                    完成度 {moviesPercent}%
                  </span>
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
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${moviesPercent}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="col-span-1 md:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between group hover:bg-white/[0.07] transition-colors duration-300">
                <div className="text-neutral-500 mb-4 flex justify-between items-center">
                  <i className="fas fa-star text-xl group-hover:text-yellow-500 transition-colors duration-300"></i>
                  <span className="text-xs text-neutral-400 bg-white/10 px-2 py-1 rounded-full">
                    满分 10 分
                  </span>
                </div>
                <div>
                  <div className="text-sm text-neutral-400 mb-1">平均观影评分</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white">
                      {currentYearData?.movie_avg_rating}
                    </span>
                    <span className="text-sm text-neutral-500">/ 10</span>
                  </div>
                </div>
              </div>
            </div>


            {/* --- 第二行：产地、语言、类型分布 (3 Columns, Top 5 Each) --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              
              {/* 1. Top Regions */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center hover:bg-white/[0.07] transition-colors duration-300">
                <div className="text-sm text-neutral-400 mb-4 flex items-center gap-2">
                  <i className="fas fa-globe-americas"></i>
                  影视产地分布 Top 5
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🇺🇸 美国</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[40%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">40%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🇨🇳 中国</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[25%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">25%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🇯🇵 日本</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[15%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">15%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🇰🇷 韩国</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[12%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">12%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🇬🇧 英国</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[8%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">8%</span>
                  </div>
                </div>
              </div>

              {/* 2. Top Languages */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center hover:bg-white/[0.07] transition-colors duration-300">
                <div className="text-sm text-neutral-400 mb-4 flex items-center gap-2">
                  <i className="fas fa-language"></i>
                  主要语言 Top 5
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🗣️ 英语</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[45%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">45%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🗣️ 中文</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[25%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">25%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🗣️ 日语</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[15%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">15%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🗣️ 韩语</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[10%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">10%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🗣️ 法语</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[5%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">5%</span>
                  </div>
                </div>
              </div>

              {/* 3. Top Genres */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center hover:bg-white/[0.07] transition-colors duration-300">
                <div className="text-sm text-neutral-400 mb-4 flex items-center gap-2">
                  <i className="fas fa-masks-theater"></i>
                  主要类型 Top 5
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">💥 动作</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[35%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">35%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">👽 科幻</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[25%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">25%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">😂 喜剧</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[20%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">20%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">🎭 剧情</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[12%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">12%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-14">👻 恐怖</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-300 w-[8%]"></div>
                    </div>
                    <span className="text-xs text-neutral-500 w-8 text-right">8%</span>
                  </div>
                </div>
              </div>
            </div> 

          </div>
        )}

        {/* 当 activeTab 是 "电视剧" 时显示 */}
        {activeTab === "电视剧" && (
          <div key="tv-shows" className="animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-6">
              电视剧追剧记录
            </h2>
            {/* 电视剧内容 */}
            <div className="col-span-2 md:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between group">
              <div className="text-neutral-500 mb-4 flex justify-between items-center">
                <i className="fas fa-list-check text-xl"></i>
                <span className="text-xs text-neutral-400 bg-white/10 px-2 py-1 rounded-full">
                  完成度 70%
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-black text-white">42</span>
                  <span className="text-sm text-neutral-400">/ 60 部计划</span>
                </div>
                {/* 极简进度条 */}
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 w-[70%] rounded-full"></div>
                </div>
              </div>
            </div>

            <div className="col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center mt-6">
              <div className="text-sm text-neutral-400 mb-4">影视产地分布</div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm w-12">🇺🇸 美国</span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-neutral-300 w-[50%]"></div>
                  </div>
                  <span className="text-xs text-neutral-500">50%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm w-12">🇯🇵 日本</span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-neutral-300 w-[30%]"></div>
                  </div>
                  <span className="text-xs text-neutral-500">30%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}