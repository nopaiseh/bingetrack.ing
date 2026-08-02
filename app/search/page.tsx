"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

// Mock Data for filters
const GENRES = ["动作", "科幻", "喜剧", "剧情", "恐怖", "悬疑", "爱情", "动画"];
const REGIONS = ["🇺🇸 美国", "🇨🇳 中国", "🇯🇵 日本", "🇰🇷 韩国", "🇬🇧 英国"];
const YEARS = ["2026", "2025", "2024", "2023", "2020以前"];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  
  // The magic toggles for AND/OR logic within categories
  const [genreLogic, setGenreLogic] = useState<"OR" | "AND">("OR");

  const toggleSelection = (item: string, list: string[], setList: (val: string[]) => void) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  return (
    <div className="min-h-screen bg-[#060606] text-neutral-200 pt-24 pb-12 selection:bg-neutral-700 selection:text-white">
      <div className="container mx-auto px-6 md:px-8 max-w-7xl">
        
        {/* Main Search Bar */}
        <div className="relative mb-12 group">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <i className="fas fa-search text-neutral-500 group-focus-within:text-red-500 transition-colors"></i>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索电影、电视剧、导演或演员..."
            className="w-full bg-white/5 border border-white/10 focus:border-red-500/50 rounded-2xl py-5 pl-12 pr-6 text-lg text-white placeholder:text-neutral-600 outline-none transition-all shadow-inner focus:bg-white/[0.07]"
          />
          {query && (
            <button 
              onClick={() => setQuery("")}
              className="absolute inset-y-0 right-0 pr-5 flex items-center text-neutral-500 hover:text-white"
            >
              <i className="fas fa-times-circle"></i>
            </button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          
          {/* LEFT SIDEBAR: Filters */}
          <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <i className="fas fa-sliders-h text-neutral-400"></i> 高级筛选
              </h2>
              <button 
                onClick={() => { setSelectedGenres([]); setSelectedRegions([]); setSelectedYears([]); }}
                className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
              >
                重置全部
              </button>
            </div>

            {/* Filter Group: Genres */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-neutral-400">类型</h3>
                {/* AND / OR Logic Toggle */}
                <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                  <button 
                    onClick={() => setGenreLogic("OR")}
                    className={`text-[10px] px-2 py-1 rounded-md transition-colors ${genreLogic === "OR" ? "bg-white/15 text-white" : "text-neutral-500 hover:text-neutral-300"}`}
                  >
                    匹配任意
                  </button>
                  <button 
                    onClick={() => setGenreLogic("AND")}
                    className={`text-[10px] px-2 py-1 rounded-md transition-colors ${genreLogic === "AND" ? "bg-white/15 text-white" : "text-neutral-500 hover:text-neutral-300"}`}
                  >
                    匹配全部
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => toggleSelection(genre, selectedGenres, setSelectedGenres)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 border ${
                      selectedGenres.includes(genre)
                        ? "bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                        : "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10 hover:text-white hover:border-white/20"
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Group: Regions */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-medium text-neutral-400">地区 (匹配任意)</h3>
              <div className="flex flex-wrap gap-2">
                {REGIONS.map((region) => (
                  <button
                    key={region}
                    onClick={() => toggleSelection(region, selectedRegions, setSelectedRegions)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 border ${
                      selectedRegions.includes(region)
                        ? "bg-white/20 border-white/40 text-white"
                        : "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>

             {/* Filter Group: Years */}
             <div className="flex flex-col gap-4">
              <h3 className="text-sm font-medium text-neutral-400">年份</h3>
              <div className="flex flex-wrap gap-2">
                {YEARS.map((year) => (
                  <button
                    key={year}
                    onClick={() => toggleSelection(year, selectedYears, setSelectedYears)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 border ${
                      selectedYears.includes(year)
                        ? "bg-white/20 border-white/40 text-white"
                        : "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* RIGHT CONTENT: Results Grid */}
          <main className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">搜索结果</h2>
              <span className="text-sm text-neutral-500">找到 42 部作品</span>
            </div>

            {/* Placeholder Grid for Results */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
              {/* Dummy items to show layout */}
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-2/3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-neutral-600 animate-pulse">
                  海报占位
                </div>
              ))}
            </div>
          </main>

        </div>
      </div>
    </div>
  );
}