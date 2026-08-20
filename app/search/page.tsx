"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getSupabaseBrowser } from "@/utils/supabase-client";
import { Media } from "@/lib/types/Media";


export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(true);

  const [genreOptions, setGenreOptions] = useState<string[]>([]);
  const [regionOptions, setRegionOptions] = useState<string[]>([]);
  const [languageOptions, setLanguageOptions] = useState<string[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>([]);

  const [mediaItems, setMediaItems] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filters, setFilters] = useState<Record<string, string[]>>({
    type: [],
    genre: [],
    region: [],
    language: [],
    year: [], 
    sort: ["date_desc"], 
  });

  useEffect(() => {
    const fetchOptions = async () => {
      const db = getSupabaseBrowser();
      const [genresRes, regionsRes, languagesRes, yearsRes] = await Promise.all([
        db.from("genres").select("name").order("name", { ascending: true }),
        db.from("regions").select("name").order("name", { ascending: true }),
        db.from("languages").select("name").order("name", { ascending: true }),
        db.from("release_year_stats").select("release_year").neq("release_year", "All Time").order("release_year", { ascending: false })
      ]);

      if (genresRes.data) setGenreOptions(genresRes.data.map((g) => g.name));
      if (regionsRes.data) setRegionOptions(regionsRes.data.map((r) => r.name));
      if (languagesRes.data) setLanguageOptions(languagesRes.data.map((l) => l.name));
      if (yearsRes.data) setYearOptions(yearsRes.data.map((y) => String(y.release_year)));
    };

    fetchOptions();
  }, []);

  useEffect(() => {
    const fetchMedia = async () => {
      setIsLoading(true);
      const db = getSupabaseBrowser();

      type MediaViewRow = {
        id: string | number;
        title?: string;
        summary?: string;
        cover_url?: string;
        sort_date?: string | null;
        type?: "movie" | "tv_series" | string;
        rating?: number | null;
        status?: string;
        date?: string;
        genres?: string[] | null;
        languages?: string[] | null;
        regions?: string[] | null;
        casts?: string[] | null;
        directors?: string[] | null;
      };

      // 构建搜索 / 筛选的 query 参数并调用受控 API
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      // 类型过滤（示例，若 filters.type 有值则优先使用第一个）
      if (filters.type && filters.type.length > 0) params.set("type", filters.type[0].toLowerCase() === "电影" ? "movie" : "tv_series");
      // 其它过滤参数（genre/region/language/year）
      if (filters.genre && filters.genre.length > 0) params.set("genre", filters.genre[0]);
      if (filters.region && filters.region.length > 0) params.set("region", filters.region[0]);
      if (filters.language && filters.language.length > 0) params.set("language", filters.language[0]);
      if (filters.year && filters.year.length > 0) params.set("year", filters.year[0]);

      setIsLoading(true);
      const res = await fetch(`/api/media?${params.toString()}`);
      const data = await res.json();

      const combinedMedia: Media[] = (data ?? []).map((item: any) => ({
        id: String(item.id),
        title: item.title ?? "",
        date: item.sort_date ?? item.date ?? item.release_date ?? "",
        runtime: item.runtime ?? null,
        rating: item.rating ?? item.average_rating ?? null,
        genres: item.genres ?? [],
        languages: item.languages ?? [],
        regions: item.regions ?? [],
        series: item.series ?? null,
        status: item.status ?? undefined,
        summary: item.summary ?? "",
        cover_url: item.cover_url ?? "",
        casts: item.casts ?? [],
        directors: item.directors ?? [],
        type: item.type === "movie" ? "movies" : item.type === "tv_series" ? "series" : undefined,
      } as Media));

      combinedMedia.sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA;
      });

      setMediaItems(combinedMedia);
      setIsLoading(false);
    };

    fetchMedia();
  }, []);

  const BUTTON_CATEGORIES = [
    { id: "type", label: "分类", options: ["电影", "电视剧", "导演", "演员"], multiSelect: true },
    { id: "genre", label: "类型", options: genreOptions, multiSelect: true },
    { id: "region", label: "地区", options: regionOptions, multiSelect: true },
    { id: "language", label: "语言", options: languageOptions, multiSelect: true },
  ];

  const toggleFilter = (categoryId: string, value: string, isMultiSelect = true, allOptions: string[] = []) => {
    setFilters((prev) => {
      const currentSelected = prev[categoryId] || [];
      if (value === "全部") return { ...prev, [categoryId]: [] }; 
      if (!isMultiSelect) return { ...prev, [categoryId]: [value] };

      if (currentSelected.includes(value)) {
        return { ...prev, [categoryId]: currentSelected.filter((item) => item !== value) };
      } else {
        const newSelected = [...currentSelected, value];
        const hasSelectedAll = allOptions.length > 0 && allOptions.every(opt => newSelected.includes(opt));
        if (hasSelectedAll) return { ...prev, [categoryId]: [] };
        return { ...prev, [categoryId]: newSelected };
      }
    });
  };

  const handleSortToggle = (fieldId: string) => {
    setFilters((prev) => {
      const currentSort = prev.sort[0] || "date_desc";
      const [currentField, currentOrder] = currentSort.split("_");
      if (currentField === fieldId) {
        const newOrder = currentOrder === "desc" ? "asc" : "desc";
        return { ...prev, sort: [`${fieldId}_${newOrder}`] };
      } else {
        return { ...prev, sort: [`${fieldId}_desc`] };
      }
    });
  };

  const handleYearChange = (type: "start" | "end", value: string) => {
    setFilters((prev) => {
      const currentStart = prev.year?.[0] || "";
      const currentEnd = prev.year?.[1] || "";
      let newStart = type === "start" ? value : currentStart;
      let newEnd = type === "end" ? value : currentEnd;

      if (newStart && newEnd && parseInt(newStart) > parseInt(newEnd)) {
        if (type === "start") newEnd = newStart;
        else newStart = newEnd;
      }
      return { ...prev, year: [newStart, newEnd] };
    });
  };

  const hasActiveFilters = Object.entries(filters).some(([key, arr]) => {
    if (key === "sort") return false; 
    if (key === "year") return arr.length > 0 && (arr[0] !== "" || arr[1] !== "");
    return arr.length > 0;
  });

  const SORT_OPTIONS = [
    { id: "date", label: "日期" },
    { id: "rating", label: "评分" }
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-200 pt-24 pb-12 selection:bg-red-600/30 selection:text-white font-sans">
      <div className="container mx-auto px-6 md:px-8 max-w-7xl">
        
        <div className="mb-8">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <i className="fas fa-search text-zinc-500 group-focus-within:text-red-500 transition-colors duration-300"></i>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索电影、电视剧、导演或演员..."
              className="w-full bg-[#0a0a0a] border border-zinc-800 focus:border-red-600 focus:ring-1 focus:ring-red-600/50 rounded-2xl py-5 pl-12 pr-40 text-lg text-white placeholder:text-zinc-600 outline-none transition-all shadow-inner"
            />
            
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center gap-3">
              {query && (
                <button onClick={() => setQuery("")} className="text-zinc-500 hover:text-white transition-colors">
                  <i className="fas fa-times-circle text-lg"></i>
                </button>
              )}
              <div className="h-6 w-px bg-zinc-800"></div>
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  showAdvanced 
                    ? "bg-red-600/10 text-red-500 border border-red-600/30 hover:bg-red-600/20" 
                    : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <i className="fas fa-sliders-h"></i>
                {showAdvanced ? "收起筛选" : "高级筛选"}
                {!showAdvanced && hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full border-2 border-black animate-pulse"></span>
                )}
              </button>
            </div>
          </div>

          {showAdvanced && (
            <div className="mt-4 p-6 bg-[#0a0a0a] border border-zinc-800/80 rounded-2xl shadow-2xl transition-all duration-300 origin-top animate-in slide-in-from-top-2 fade-in">
              <div className="flex flex-col">
                
                {BUTTON_CATEGORIES.map((category) => {
                  const activeSelections = filters[category.id] || [];
                  const isAllSelected = activeSelections.length === 0;

                  return (
                    <div key={category.id} className="flex items-start py-4 border-b border-zinc-800/60">
                      <span className="text-zinc-500 text-sm font-medium w-16 shrink-0 mt-1.5 tracking-wider">{category.label}</span>
                      <div className="flex flex-wrap gap-x-3 gap-y-2 flex-1 items-center">
                        <button
                          onClick={() => toggleFilter(category.id, "全部", category.multiSelect, category.options)}
                          className={`px-4 py-1.5 rounded-lg text-[13px] transition-all duration-200 ${
                            isAllSelected 
                              ? "bg-red-600 text-white font-medium shadow-[0_0_15px_rgba(220,38,38,0.3)]" 
                              : "bg-transparent text-zinc-400 border border-transparent hover:border-zinc-700 hover:text-zinc-200"
                          }`}
                        >
                          全部
                        </button>
                        
                        {category.options.map((option) => {
                          const isSelected = activeSelections.includes(option);
                          return (
                            <button
                              key={option}
                              onClick={() => toggleFilter(category.id, option, category.multiSelect, category.options)}
                              className={`group flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] transition-all duration-200 ${
                                isSelected 
                                  ? "bg-red-600 text-white font-medium shadow-[0_0_15px_rgba(220,38,38,0.3)]" 
                                  : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                              }`}
                            >
                              {option}
                              {isSelected && <i className="fas fa-times text-[10px] opacity-60 group-hover:opacity-100 transition-opacity ml-1"></i>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center py-4 border-b border-zinc-800/60">
                  <span className="text-zinc-500 text-sm font-medium w-16 shrink-0 tracking-wider">年份</span>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, year: [] }))}
                      className={`px-4 py-1.5 rounded-lg text-[13px] transition-all duration-200 ${
                        !filters.year?.length || (filters.year[0] === "" && filters.year[1] === "")
                          ? "bg-red-600 text-white font-medium shadow-[0_0_15px_rgba(220,38,38,0.3)]" 
                          : "bg-transparent text-zinc-400 border border-transparent hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      全部
                    </button>

                    <div className="flex items-center gap-2">
                      <div className="relative group">
                        <select
                          value={filters.year?.[0] || ""}
                          onChange={(e) => handleYearChange("start", e.target.value)}
                          className="appearance-none bg-zinc-900 border border-zinc-800 text-zinc-300 text-[13px] rounded-lg pl-3 pr-8 py-1.5 focus:border-red-600 outline-none hover:border-zinc-600 transition-colors cursor-pointer min-w-[100px]"
                        >
                          <option value="" disabled hidden>开始年份</option>
                          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 group-hover:text-zinc-300 pointer-events-none transition-colors"></i>
                      </div>

                      <span className="text-zinc-600 text-[13px] font-medium px-1">至</span>

                      <div className="relative group">
                        <select
                          value={filters.year?.[1] || ""}
                          onChange={(e) => handleYearChange("end", e.target.value)}
                          className="appearance-none bg-zinc-900 border border-zinc-800 text-zinc-300 text-[13px] rounded-lg pl-3 pr-8 py-1.5 focus:border-red-600 outline-none hover:border-zinc-600 transition-colors cursor-pointer min-w-[100px]"
                        >
                          <option value="" disabled hidden>最终年份</option>
                          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 group-hover:text-zinc-300 pointer-events-none transition-colors"></i>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start py-4">
                  <span className="text-zinc-500 text-sm font-medium w-16 shrink-0 mt-1.5 tracking-wider">排序</span>
                  <div className="flex flex-wrap gap-x-3 gap-y-2 flex-1 items-center">
                    {SORT_OPTIONS.map((option) => {
                      const currentSort = filters.sort?.[0] || "date_desc";
                      const [currentField, currentOrder] = currentSort.split("_");
                      const isSelected = currentField === option.id;

                      return (
                        <button
                          key={option.id}
                          onClick={() => handleSortToggle(option.id)}
                          className={`group flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] transition-all duration-200 ${
                            isSelected 
                              ? "bg-red-600 text-white font-medium shadow-[0_0_15px_rgba(220,38,38,0.3)]" 
                              : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                          }`}
                        >
                          {option.label}
                          {isSelected && (
                            <i className={`fas fa-arrow-${currentOrder === "desc" ? "down" : "up"} text-[11px] transition-transform`}></i>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        <main className="w-full">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white tracking-wide">
              {query ? (
                <>
                  <span className="text-red-500">"{query}"</span> 的搜索结果
                </>
              ) : "全部媒体"}
            </h2>
            <div className="flex items-center gap-4">
               {hasActiveFilters && (
                  <button 
                    onClick={() => setFilters({ type: [], genre: [], region: [], language: [], year: [], sort: ["date_desc"] })}
                    className="text-sm text-zinc-500 hover:text-red-500 transition-colors"
                  >
                    清空筛选
                  </button>
               )}
               <span className="text-sm px-3 py-1 bg-zinc-900 rounded-full border border-zinc-800 text-zinc-400">
                 {isLoading ? "加载中..." : `找到 ${mediaItems.length} 部作品`}
               </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {isLoading ? (
              [...Array(12)].map((_, i) => (
                <div key={i} className="flex flex-col bg-zinc-900 border border-zinc-800/50 rounded-xl overflow-hidden animate-pulse">
                  <div className="w-full aspect-[2/3] bg-zinc-800/50"></div>
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
                    <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
                  </div>
                </div>
              ))
            ) : mediaItems.length > 0 ? (
              mediaItems.map((item) => (
                <div key={item.id} className="group flex flex-col bg-zinc-900 border border-zinc-800/50 rounded-xl overflow-hidden cursor-pointer shadow-lg shadow-black/50 transition-all duration-300 hover:border-zinc-600 hover:-translate-y-1">
                  
                  
                  <div className="w-full aspect-[2/3] bg-neutral-900 relative flex items-center justify-center overflow-hidden">
                    {item.cover_url ? (
                      <Image
                        src={item.cover_url}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
                      />
                    ) : (
                      <i className="fas fa-image text-4xl text-neutral-700 opacity-40"></i>
                    )}
                  </div>
                  
                  
                  <div className="flex flex-col space-y-1 grow px-2 py-2">
                    
                    <h3 className="text-sm font-semibold text-white truncate" title={item.title}>
                      {item.title}
                    </h3>

                    
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-400">{item.date ? item.date.substring(0, 4) : "未知"}</span>
                      <span className="text-neutral-300 font-semibold flex items-center gap-1">
                        {item.rating ? (
                          <>
                            <i className="fas fa-star text-yellow-500 text-[10px]"></i>
                            {Number(item.rating).toFixed(1)}
                          </>
                        ) : (
                          <span className="text-neutral-400">未评分</span>
                        )}
                      </span>
                    </div>
                    
                    
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(item.genres ?? []).slice(0, 3).map((g: string, i: number) => (
                        <span key={`g-${i}`} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/[0.03] border border-white/10 text-neutral-300 text-[10px] font-medium tracking-wide transition-all hover:bg-white/10 hover:text-white hover:border-white/20">
                          {g}
                        </span>
                      ))}
                      {(item.languages ?? []).slice(0, 2).map((l: string, i: number) => (
                        <span key={`l-${i}`} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/[0.03] border border-white/10 text-neutral-300 text-[10px] font-medium tracking-wide transition-all hover:bg-white/10 hover:text-white hover:border-white/20">
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-20 text-center text-zinc-500">
                暂无符合条件的作品
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}