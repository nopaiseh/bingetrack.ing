"use client";

import Link from "next/link";
import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/utils/supabase-client";
import { Media, ViewAllMediaRow } from "@/lib/types";
import { mapViewRowToMedia } from "@/lib/functions/media-mapper";

function SearchContent() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(urlQuery);
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);

  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
    setQuery(urlQuery);
  }

  const [filters, setFilters] = useState<Record<string, string[]>>({
    type: searchParams.get("type") ? searchParams.get("type")!.split(",") : [],
    status: searchParams.get("status") ? searchParams.get("status")!.split(",") : [],
    genre: searchParams.get("genre") ? searchParams.get("genre")!.split(",") : [],
    region: searchParams.get("region") ? searchParams.get("region")!.split(",") : [],
    language: searchParams.get("language") ? searchParams.get("language")!.split(",") : [],
    year: searchParams.get("startYear") || searchParams.get("endYear") 
      ? [searchParams.get("startYear") || "", searchParams.get("endYear") || ""] 
      : [],
    sort: searchParams.get("sort") ? [searchParams.get("sort")!] : ["date_desc"],
  });

  const [showAdvanced, setShowAdvanced] = useState(true);

  const [genreOptions, setGenreOptions] = useState<string[]>([]);
  const [regionOptions, setRegionOptions] = useState<string[]>([]);
  const [languageOptions, setLanguageOptions] = useState<string[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>([]);

  const [mediaItems, setMediaItems] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  const observer = useRef<IntersectionObserver | null>(null);
  
  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading || isLoadingMore) return; 
      
      if (observer.current) observer.current.disconnect();
      
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore) {
            setPage((prevPage) => prevPage + 1);
          }
        },
        { rootMargin: "200px" }
      );
      
      if (node) observer.current.observe(node);
    },
    [isLoading, isLoadingMore, hasMore, page]
  );

  const LIMIT = 30;

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setMediaItems([]);
  }, [query, filters]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const fetchOptions = async () => {
      const db = getSupabaseBrowser();
      const [genresRes, regionsRes, languagesRes, yearsRes] = await Promise.all(
        [
          db.from("genres").select("name").order("name", { ascending: true }),
          db.from("regions").select("name").order("name", { ascending: true }),
          db.from("languages").select("name").order("name", { ascending: true }),
          db.from("release_year_stats").select("release_year").neq("release_year", "All Time").order("release_year", { ascending: false }),
        ],
      );

      if (genresRes.data) setGenreOptions(genresRes.data.map((g) => g.name));
      if (regionsRes.data) setRegionOptions(regionsRes.data.map((r) => r.name));
      if (languagesRes.data) setLanguageOptions(languagesRes.data.map((l) => l.name));
      if (yearsRes.data) setYearOptions(yearsRes.data.map((y) => String(y.release_year)));
    };

    fetchOptions();
  }, []);

  useEffect(() => {
    const fetchMedia = async () => {
      if (page === 1) setIsLoading(true);
      else setIsLoadingMore(true);

      const params = new URLSearchParams();
      if (query) params.set("q", query);

      if (filters.type && filters.type.length > 0) {
        const typeMap: Record<string, string> = { 电影: "movie", 电视剧: "tv_series" };
        const mappedTypes = filters.type.map((t) => typeMap[t]).filter(Boolean);
        if (mappedTypes.length > 0) params.set("type", mappedTypes.join(","));
      }

      if (filters.status && filters.status.length > 0) {
        const statusMap: Record<string, string> = { 想看: "want_to_watch", 在看: "watching", 已看: "watched" };
        const mappedStatuses = filters.status.map((s) => statusMap[s]).filter(Boolean);
        if (mappedStatuses.length > 0) params.set("status", mappedStatuses.join(","));
      }

      if (filters.genre && filters.genre.length > 0) params.set("genre", filters.genre.join(","));
      if (filters.region && filters.region.length > 0) params.set("region", filters.region.join(","));
      if (filters.language && filters.language.length > 0) params.set("language", filters.language.join(","));

      if (filters.year && filters.year.length === 2) {
        if (filters.year[0]) params.set("startYear", filters.year[0]);
        if (filters.year[1]) params.set("endYear", filters.year[1]);
      }

      if (filters.sort && filters.sort.length > 0) params.set("sort", filters.sort[0]);

      params.set("limit", LIMIT.toString());
      params.set("offset", ((page - 1) * LIMIT).toString());

      try {
        const res = await fetch(`/api/media?${params.toString()}`);
        const json = await res.json();
        const dataArray: ViewAllMediaRow[] = Array.isArray(json) ? json : (json.rows ?? json.data ?? []);
        const combinedMedia: Media[] = dataArray.map((item) => mapViewRowToMedia(item));

        if (combinedMedia.length < LIMIT) setHasMore(false);

        if (page === 1) setMediaItems(combinedMedia);
        else setMediaItems((prev) => [...prev, ...combinedMedia]);
      } catch (error) {
        console.error("Failed to fetch media:", error);
        setMediaItems([]);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    };

    fetchMedia();
  }, [query, filters, page]);

  const BUTTON_CATEGORIES = [
    { id: "type", label: "分类", options: ["电影", "电视剧"], multiSelect: true },
    { id: "status", label: "状态", options: ["想看", "在看", "已看"], multiSelect: true },
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
        const hasSelectedAll = allOptions.length > 0 && allOptions.every((opt) => newSelected.includes(opt));
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
    { id: "rating", label: "评分" },
  ];

  return (
    <div className="min-h-screen text-neutral-200 pt-24 pb-12 selection:bg-red-500/30 selection:text-white font-sans relative">
      <div className="container mx-auto px-6 md:px-8 max-w-7xl relative z-[1]">
        
        {/* Search Input Section */}
        <div className="mb-8">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none z-10">
              <i className="fas fa-search text-white/50 group-focus-within:text-red-400 group-focus-within:drop-shadow-[0_0_5px_rgba(248,113,113,0.6)] transition-all duration-300"></i>
            </div>
            {/* Lighter Frosted Glass Search Input (UNCHANGED) */}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索电影、电视剧、导演或演员..."
              className="w-full bg-white/5 backdrop-blur-2xl border border-white/10 focus:border-red-400/50 focus:ring-1 focus:ring-red-400/50 focus:bg-white/10 rounded-2xl py-5 pl-12 pr-40 text-lg text-white placeholder-white/40 outline-none transition-all duration-500 shadow-[0_4px_20px_rgba(0,0,0,0.2)] focus:shadow-[0_6px_30px_rgba(248,113,113,0.2)] relative z-0"
            />

            <div className="absolute inset-y-0 right-0 pr-4 flex items-center gap-3 z-10">
              {query && (
                <button onClick={() => setQuery("")} className="text-white/50 hover:text-red-400 hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.6)] transition-all duration-300">
                  <i className="fas fa-times-circle text-lg"></i>
                </button>
              )}
              <div className="h-6 w-px bg-white/20"></div>
              {/* Lighter Frosted Glass Advanced Filter Button */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 backdrop-blur-2xl ${
                  showAdvanced
                    ? "bg-red-500/15 text-red-400 border border-red-400/40 shadow-[0_4px_15px_rgba(248,113,113,0.2)] drop-shadow-[0_0_3px_rgba(248,113,113,0.3)]"
                    : "bg-white/5 text-white/70 border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.2)] hover:bg-white/10 hover:text-white hover:border-white/20 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)]"
                }`}
              >
                <i className="fas fa-sliders-h"></i>
                {showAdvanced ? "收起筛选" : "高级筛选"}
                {!showAdvanced && hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full border border-black/50 shadow-[0_0_8px_rgba(248,113,113,0.8)] animate-pulse"></span>
                )}
              </button>
            </div>
          </div>

          {/* Lighter Frosted Glass Filter Panel */}
          {showAdvanced && (
            <div className="mt-4 p-6 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.5)] transition-all duration-300 origin-top animate-in slide-in-from-top-2 fade-in">
              <div className="flex flex-col">
                {BUTTON_CATEGORIES.map((category) => {
                  const activeSelections = filters[category.id] || [];
                  const isAllSelected = activeSelections.length === 0;

                  return (
                    <div key={category.id} className="flex items-start py-4 border-b border-white/10">
                      <span className="text-white/60 text-sm font-medium w-16 shrink-0 mt-1.5 tracking-wider drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">
                        {category.label}
                      </span>
                      <div className="flex flex-wrap gap-x-3 gap-y-2 flex-1 items-center">
                        <button
                          onClick={() => toggleFilter(category.id, "全部", category.multiSelect, category.options)}
                          className={`px-4 py-1.5 rounded-lg text-[13px] transition-all duration-300 backdrop-blur-2xl ${
                            isAllSelected
                              ? "bg-red-500/15 text-red-400 font-bold border border-red-400/40 shadow-[0_4px_10px_rgba(248,113,113,0.2)] drop-shadow-[0_0_3px_rgba(248,113,113,0.3)]"
                              : "bg-white/5 text-white/70 border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.2)] hover:bg-white/10 hover:text-white hover:border-white/20 hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
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
                              className={`group flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] transition-all duration-300 backdrop-blur-2xl ${
                                isSelected
                                  ? "bg-red-500/15 text-red-400 font-bold border border-red-400/40 shadow-[0_4px_10px_rgba(248,113,113,0.2)] drop-shadow-[0_0_3px_rgba(248,113,113,0.3)]"
                                  : "bg-white/5 text-white/70 border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.2)] hover:bg-white/10 hover:text-white hover:border-white/20 hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                              }`}
                            >
                              {option}
                              {isSelected && (
                                <i className="fas fa-times text-[10px] opacity-60 group-hover:opacity-100 transition-opacity ml-1"></i>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center py-4 border-b border-white/10">
                  <span className="text-white/60 text-sm font-medium w-16 shrink-0 tracking-wider drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">
                    年份
                  </span>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setFilters((prev) => ({ ...prev, year: [] }))}
                      className={`px-4 py-1.5 rounded-lg text-[13px] transition-all duration-300 backdrop-blur-2xl ${
                        !filters.year?.length || (filters.year[0] === "" && filters.year[1] === "")
                          ? "bg-red-500/15 text-red-400 font-bold border border-red-400/40 shadow-[0_4px_10px_rgba(248,113,113,0.2)] drop-shadow-[0_0_3px_rgba(248,113,113,0.3)]"
                          : "bg-white/5 text-white/70 border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.2)] hover:bg-white/10 hover:text-white hover:border-white/20 hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                      }`}
                    >
                      全部
                    </button>

                    <div className="flex items-center gap-2">
                      <div className="relative group">
                        <select
                          value={filters.year?.[0] || ""}
                          onChange={(e) => handleYearChange("start", e.target.value)}
                          className="appearance-none bg-white/5 backdrop-blur-2xl border border-white/10 text-white text-[13px] rounded-lg pl-3 pr-8 py-1.5 focus:border-red-400/50 focus:bg-white/10 outline-none hover:bg-white/10 hover:border-white/20 hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] transition-all cursor-pointer min-w-25 shadow-[0_4px_10px_rgba(0,0,0,0.2)]"
                        >
                          <option value="" disabled hidden className="bg-neutral-900 text-neutral-300">开始年份</option>
                          {yearOptions.map((y) => (
                            <option key={y} value={y} className="bg-neutral-900 text-neutral-300">{y}</option>
                          ))}
                        </select>
                        <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/50 group-hover:text-white pointer-events-none transition-colors"></i>
                      </div>

                      <span className="text-white/60 text-[13px] font-medium px-1">至</span>

                      <div className="relative group">
                        <select
                          value={filters.year?.[1] || ""}
                          onChange={(e) => handleYearChange("end", e.target.value)}
                          className="appearance-none bg-white/5 backdrop-blur-2xl border border-white/10 text-white text-[13px] rounded-lg pl-3 pr-8 py-1.5 focus:border-red-400/50 focus:bg-white/10 outline-none hover:bg-white/10 hover:border-white/20 hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] transition-all cursor-pointer min-w-25 shadow-[0_4px_10px_rgba(0,0,0,0.2)]"
                        >
                          <option value="" disabled hidden className="bg-neutral-900 text-neutral-300">最终年份</option>
                          {yearOptions.map((y) => (
                            <option key={y} value={y} className="bg-neutral-900 text-neutral-300">{y}</option>
                          ))}
                        </select>
                        <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/50 group-hover:text-white pointer-events-none transition-colors"></i>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start py-4">
                  <span className="text-white/60 text-sm font-medium w-16 shrink-0 mt-1.5 tracking-wider drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">
                    排序
                  </span>
                  <div className="flex flex-wrap gap-x-3 gap-y-2 flex-1 items-center">
                    {SORT_OPTIONS.map((option) => {
                      const currentSort = filters.sort?.[0] || "date_desc";
                      const [currentField, currentOrder] = currentSort.split("_");
                      const isSelected = currentField === option.id;

                      return (
                        <button
                          key={option.id}
                          onClick={() => handleSortToggle(option.id)}
                          className={`group flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] transition-all duration-300 backdrop-blur-2xl ${
                            isSelected
                              ? "bg-red-500/15 text-red-400 font-bold border border-red-400/40 shadow-[0_4px_10px_rgba(248,113,113,0.2)] drop-shadow-[0_0_3px_rgba(248,113,113,0.3)]"
                              : "bg-white/5 text-white/70 border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.2)] hover:bg-white/10 hover:text-white hover:border-white/20 hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
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
            <h2 className="text-2xl font-bold text-white tracking-wide drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              {query ? (
                <>
                  <span className="text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]">&quot;{query}&quot;</span> 的搜索结果
                </>
              ) : (
                "全部媒体"
              )}
            </h2>
            <div className="flex items-center gap-4">
              {hasActiveFilters && (
                <button
                  onClick={() => setFilters({ type: [], status: [], genre: [], region: [], language: [], year: [], sort: ["date_desc"] })}
                  className="text-sm text-white/60 hover:text-red-400 hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.5)] transition-all duration-300"
                >
                  清空筛选
                </button>
              )}
              {/* Lighter Frosted Glass Pill for Item Count */}
              <span className="text-sm px-4 py-1.5 bg-white/5 backdrop-blur-2xl rounded-full border border-white/10 text-white font-medium shadow-[0_4px_10px_rgba(0,0,0,0.2)] drop-shadow-[0_0_8px_rgba(255,255,255,0.1)] transition-all">
                {isLoading ? "加载中..." : `找到 ${mediaItems.length} 部作品`}
              </span>
            </div>
          </div>

          {/* Lighter Frosted Glass Media Posters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {isLoading ? (
              [...Array(12)].map((_, i) => (
                <div key={i} className="flex flex-col bg-white/5 backdrop-blur-2xl border border-white/10 rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.2)] animate-pulse">
                  <div className="w-full aspect-2/3 bg-white/5"></div>
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-white/10 rounded w-3/4"></div>
                    <div className="h-3 bg-white/10 rounded w-1/2"></div>
                  </div>
                </div>
              ))
            ) : mediaItems.length > 0 ? (
              <>
                {mediaItems.map((item, index) => (
                  <Link
                    key={item.id}
                    href={`/${item.type}/${item.id}`}
                    /* Interactive Lighter Frosted Glass Poster Container */
                    className="group flex flex-col bg-white/5 backdrop-blur-2xl border border-white/10 rounded-xl overflow-hidden cursor-pointer shadow-[0_10px_30px_rgba(0,0,0,0.2)] transition-all duration-300 hover:border-red-400/40 hover:bg-white/10 hover:-translate-y-1.5 hover:shadow-[0_15px_40px_rgba(248,113,113,0.2)] animate-in fade-in zoom-in-95 duration-500"
                    style={{ animationDelay: `${(index % LIMIT) * 50}ms`, animationFillMode: "both" }}
                  >
                    <div className="w-full aspect-2/3 relative flex items-center justify-center overflow-hidden bg-black/60">
                      {item.cover_url ? (
                        <Image
                          src={item.cover_url}
                          alt={item.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
                        />
                      ) : (
                        <i className="fas fa-image text-4xl text-white/20 drop-shadow-md"></i>
                      )}
                    </div>

                    <div className="flex flex-col space-y-1.5 grow px-3 py-2.5">
                      <h3 className="text-sm font-bold text-white truncate drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] group-hover:text-red-300 group-hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.6)] transition-colors duration-300" title={item.title}>
                        {item.title}
                      </h3>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/60 font-medium">
                          {item.date ? item.date.substring(0, 4) : "未知"}
                        </span>
                        <span className="text-white font-bold flex items-center gap-1 drop-shadow-sm">
                          {item.rating ? (
                            <>
                              <i className="fas fa-star text-yellow-500/90 text-[10px] drop-shadow-[0_0_5px_rgba(234,179,8,0.6)]"></i>
                              {Number(item.rating).toFixed(1)}
                            </>
                          ) : (
                            <span className="text-white/50">未评分</span>
                          )}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {(item.genres ?? []).slice(0, 3).map((g: string, i: number) => (
                          <span
                            key={`g-${i}`}
                            className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/5 backdrop-blur-md border border-white/10 text-white/70 text-[10px] font-medium tracking-wide transition-all duration-300 group-hover:bg-red-500/15 group-hover:text-red-300 group-hover:border-red-400/30 group-hover:shadow-[0_4px_10px_rgba(248,113,113,0.2)]"
                          >
                            {g}
                          </span>
                        ))}
                        {(item.languages ?? []).slice(0, 2).map((l: string, i: number) => (
                          <span
                            key={`l-${i}`}
                            className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/5 backdrop-blur-md border border-white/10 text-white/70 text-[10px] font-medium tracking-wide transition-all duration-300 group-hover:bg-red-500/15 group-hover:text-red-300 group-hover:border-red-400/30 group-hover:shadow-[0_4px_10px_rgba(248,113,113,0.2)]"
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                ))}

                {/* Skeletons generated dynamically inside the grid during infinite scroll */}
                {isLoadingMore && (
                  [...Array(6)].map((_, i) => (
                    <div key={`loading-more-${i}`} className="flex flex-col bg-white/5 backdrop-blur-2xl border border-white/10 rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.2)] animate-pulse">
                      <div className="w-full aspect-2/3 bg-white/5"></div>
                      <div className="p-3 space-y-2">
                        <div className="h-4 bg-white/10 rounded w-3/4"></div>
                        <div className="h-3 bg-white/10 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))
                )}
              </>
            ) : (
              <div className="col-span-full py-20 text-center text-white/50 backdrop-blur-sm font-medium">
                暂无符合条件的作品
              </div>
            )}
          </div>
          
          {/* Intersection Observer Target */}
          {mediaItems.length > 0 && (
            <div ref={lastElementRef} className="w-full py-10 flex justify-center items-center h-20">
              {!hasMore && (
                <div className="text-white/50 text-sm font-medium tracking-wide backdrop-blur-sm animate-in fade-in duration-500">
                  — 到底啦，所有的作品都在这了 —
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Lighter Frosted Glass Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-22 right-12 w-12 h-12 rounded-full bg-white/5 backdrop-blur-2xl border border-white/10 text-white/70 flex items-center justify-center shadow-[0_4px_15px_rgba(0,0,0,0.2)] transition-all duration-300 z-50 hover:bg-white/10 hover:text-red-400 hover:border-red-400/50 hover:shadow-[0_6px_25px_rgba(248,113,113,0.3)] hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.5)] hover:scale-105 ${
          showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
        }`}
      >
        <i className="fas fa-arrow-up text-lg"></i>
      </button>
    </div>
  );
}

export default function SearchPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white/60">
          <i className="fas fa-circle-notch fa-spin text-2xl text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]"></i>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}