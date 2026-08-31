"use client";

import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/utils/supabase-client";
import { Media } from "@/lib/types";
import { SearchMediaCard, SearchMediaCardSkeleton } from "@/components/SearchMediaCard";
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, LoaderCircle, Search, SlidersHorizontal, X } from "lucide-react";

const PAGE_SIZE = 30;

function pageNumbers(current: number, total: number) {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function SearchContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") || "";
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const returnHref = searchParams.size > 0 ? `${pathname}?${searchParams.toString()}` : pathname;

  const [query, setQuery] = useState(urlQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(urlQuery);
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
  const [requestError, setRequestError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const resultsRef = useRef<HTMLElement | null>(null);

  const updatePage = useCallback((nextPage: number, replace = false) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");
    const href = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [pathname, router, searchParams]);

  const resetPagination = useCallback(() => {
    if (page > 1) updatePage(1, true);
  }, [page, updatePage]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
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
    const controller = new AbortController();

    const fetchMedia = async () => {
      setIsLoading(true);

      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);

      if (filters.type && filters.type.length > 0) {
        const typeMap: Record<string, string> = { 电影: "movie", 电视剧: "tv_series" };
        const creditRoleMap: Record<string, string> = { 导演: "director", 演员: "actor" };
        const mappedTypes = filters.type.map((t) => typeMap[t]).filter(Boolean);
        const mappedCreditRoles = filters.type.map((t) => creditRoleMap[t]).filter(Boolean);
        if (mappedTypes.length > 0) params.set("type", mappedTypes.join(","));
        if (filters.type.includes("系列")) params.set("series", "true");
        if (mappedCreditRoles.length > 0) params.set("creditRole", mappedCreditRoles.join(","));
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

      params.set("limit", PAGE_SIZE.toString());
      params.set("offset", ((page - 1) * PAGE_SIZE).toString());

      try {
        setRequestError(null);
        const res = await fetch(`/api/media?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`Media request failed with status ${res.status}`);
        const json: { rows?: Media[]; total?: number } = await res.json();
        setMediaItems(json.rows ?? []);
        setTotal(json.total ?? 0);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Failed to fetch media:", error);
        setRequestError("暂时无法加载搜索结果，请稍后重试。");
        setMediaItems([]);
        setTotal(0);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchMedia();
    return () => controller.abort();
  }, [debouncedQuery, filters, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!isLoading && page > totalPages) updatePage(totalPages, true);
  }, [isLoading, page, totalPages, updatePage]);

  const goToPage = (nextPage: number) => {
    updatePage(nextPage);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const BUTTON_CATEGORIES = [
    { id: "type", label: "分类", options: ["电影", "电视剧", "系列", "导演", "演员"], multiSelect: true },
    { id: "status", label: "状态", options: ["想看", "在看", "已看"], multiSelect: true },
    { id: "genre", label: "类型", options: genreOptions, multiSelect: true },
    { id: "region", label: "地区", options: regionOptions, multiSelect: true },
    { id: "language", label: "语言", options: languageOptions, multiSelect: true },
  ];

  const toggleFilter = (categoryId: string, value: string, isMultiSelect = true, allOptions: string[] = []) => {
    resetPagination();
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
    resetPagination();
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
    resetPagination();
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
      <div className="container relative z-1 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Search Input Section */}
        <div className="mb-8">
          <div className="group relative grid gap-2 sm:block">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none z-10">
              <Search className="size-4 text-white/50 group-focus-within:text-red-400 group-focus-within:drop-shadow-[0_0_5px_rgba(248,113,113,0.6)] transition-all duration-300" aria-hidden="true" />
            </div>
            
            <input
              type="text"
              value={query}
              onChange={(e) => {
                resetPagination();
                setQuery(e.target.value);
              }}
              placeholder="搜索电影、电视剧、导演或演员..."
              className="glass-control relative z-0 w-full rounded-2xl py-4 pl-12 pr-12 text-base text-white outline-none transition-all duration-500 placeholder:text-white/50 focus:border-red-400/50 focus:bg-white/10 focus:ring-1 focus:ring-red-400/50 focus:shadow-[0_6px_30px_rgba(248,113,113,0.2)] sm:py-5 sm:pr-40 sm:text-lg"
            />

            <div className="z-10 flex min-h-11 items-center justify-end gap-3 sm:absolute sm:inset-y-0 sm:right-0 sm:pr-4">
              {query && (
                <button onClick={() => {
                  resetPagination();
                  setQuery("");
                }} className="text-white/50 hover:text-red-400 hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.6)] transition-all duration-300" aria-label="清除搜索">
                  <X className="size-5" aria-hidden="true" />
                </button>
              )}
              <div className="hidden h-6 w-px bg-white/20 sm:block"></div>
              
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`relative flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300 backdrop-blur-2xl ${
                  showAdvanced
                    ? "bg-red-500/15 text-red-400 border border-red-400/40 shadow-[0_4px_15px_rgba(248,113,113,0.2)] drop-shadow-[0_0_3px_rgba(248,113,113,0.3)]"
                    : "bg-white/5 text-white/70 border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.2)] hover:bg-white/10 hover:text-white hover:border-white/20 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)]"
                }`}
              >
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                {showAdvanced ? "收起筛选" : "高级筛选"}
                {!showAdvanced && hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full border border-black/50 shadow-[0_0_8px_rgba(248,113,113,0.8)] animate-pulse"></span>
                )}
              </button>
            </div>
          </div>

          {showAdvanced && (
            <div className="glass-panel mt-4 origin-top rounded-2xl p-4 transition-all duration-300 animate-in slide-in-from-top-2 fade-in sm:p-6">
              <div className="flex flex-col">
                {BUTTON_CATEGORIES.map((category) => {
                  const activeSelections = filters[category.id] || [];
                  const isAllSelected = activeSelections.length === 0;

                  return (
                    <div key={category.id} className="flex flex-col items-start gap-3 border-b border-white/10 py-4 sm:flex-row sm:gap-0">
                      <span className="text-white/60 text-sm font-medium w-16 shrink-0 mt-1.5 tracking-wider drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">
                        {category.label}
                      </span>
                      <div className="flex flex-wrap gap-x-3 gap-y-2 flex-1 items-center">
                        <button
                          onClick={() => toggleFilter(category.id, "全部", category.multiSelect, category.options)}
                          className={`min-h-10 rounded-lg px-4 py-1.5 text-[13px] transition-all duration-300 backdrop-blur-2xl ${
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
                              className={`group flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-1.5 text-[13px] transition-all duration-300 backdrop-blur-2xl ${
                                isSelected
                                  ? "bg-red-500/15 text-red-400 font-bold border border-red-400/40 shadow-[0_4px_10px_rgba(248,113,113,0.2)] drop-shadow-[0_0_3px_rgba(248,113,113,0.3)]"
                                  : "bg-white/5 text-white/70 border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.2)] hover:bg-white/10 hover:text-white hover:border-white/20 hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                              }`}
                            >
                              {option}
                              {isSelected && (
                                <X className="ml-1 size-3 opacity-60 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="flex flex-col items-start gap-3 border-b border-white/10 py-4 sm:flex-row sm:items-center sm:gap-0">
                  <span className="text-white/60 text-sm font-medium w-16 shrink-0 tracking-wider drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">
                    年份
                  </span>
                  <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
                    <button
                      onClick={() => {
                        resetPagination();
                        setFilters((prev) => ({ ...prev, year: [] }));
                      }}
                      className={`min-h-10 rounded-lg px-4 py-1.5 text-[13px] transition-all duration-300 backdrop-blur-2xl ${
                        !filters.year?.length || (filters.year[0] === "" && filters.year[1] === "")
                          ? "bg-red-500/15 text-red-400 font-bold border border-red-400/40 shadow-[0_4px_10px_rgba(248,113,113,0.2)] drop-shadow-[0_0_3px_rgba(248,113,113,0.3)]"
                          : "bg-white/5 text-white/70 border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.2)] hover:bg-white/10 hover:text-white hover:border-white/20 hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                      }`}
                    >
                      全部
                    </button>

                    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:w-auto">
                      <div className="relative group">
                        <select
                          value={filters.year?.[0] || ""}
                          onChange={(e) => handleYearChange("start", e.target.value)}
                          className="min-h-10 w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 py-1.5 pl-3 pr-8 text-[13px] text-white shadow-[0_4px_10px_rgba(0,0,0,0.2)] backdrop-blur-2xl transition-all outline-none hover:border-white/20 hover:bg-white/10 hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] focus:border-red-400/50 focus:bg-white/10 sm:min-w-25"
                        >
                          <option value="" disabled hidden className="bg-neutral-900 text-neutral-300">开始年份</option>
                          {yearOptions.map((y) => (
                            <option key={y} value={y} className="bg-neutral-900 text-neutral-300">{y}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 size-3 -translate-y-1/2 text-white/50 group-hover:text-white pointer-events-none transition-colors" aria-hidden="true" />
                      </div>

                      <span className="text-white/60 text-[13px] font-medium px-1">至</span>

                      <div className="relative group">
                        <select
                          value={filters.year?.[1] || ""}
                          onChange={(e) => handleYearChange("end", e.target.value)}
                          className="min-h-10 w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 py-1.5 pl-3 pr-8 text-[13px] text-white shadow-[0_4px_10px_rgba(0,0,0,0.2)] backdrop-blur-2xl transition-all outline-none hover:border-white/20 hover:bg-white/10 hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] focus:border-red-400/50 focus:bg-white/10 sm:min-w-25"
                        >
                          <option value="" disabled hidden className="bg-neutral-900 text-neutral-300">最终年份</option>
                          {yearOptions.map((y) => (
                            <option key={y} value={y} className="bg-neutral-900 text-neutral-300">{y}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 size-3 -translate-y-1/2 text-white/50 group-hover:text-white pointer-events-none transition-colors" aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:gap-0">
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
                          className={`group flex min-h-10 items-center gap-2 rounded-lg px-4 py-1.5 text-[13px] transition-all duration-300 backdrop-blur-2xl ${
                            isSelected
                              ? "bg-red-500/15 text-red-400 font-bold border border-red-400/40 shadow-[0_4px_10px_rgba(248,113,113,0.2)] drop-shadow-[0_0_3px_rgba(248,113,113,0.3)]"
                              : "bg-white/5 text-white/70 border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.2)] hover:bg-white/10 hover:text-white hover:border-white/20 hover:shadow-[0_6px_15px_rgba(0,0,0,0.3)] hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                          }`}
                        >
                          {option.label}
                          {isSelected && (
                            currentOrder === "desc" ? <ArrowDown className="size-3" aria-hidden="true" /> : <ArrowUp className="size-3" aria-hidden="true" />
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

        <main ref={resultsRef} className="w-full scroll-mt-24">
          <div className="mb-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <h2 className="text-2xl font-bold text-white tracking-wide drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              {query ? (
                <>
                  <span className="text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]">&quot;{query}&quot;</span> 的搜索结果
                </>
              ) : (
                "搜索结果"
              )}
            </h2>
            <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end sm:gap-4">
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    resetPagination();
                    setFilters({ type: [], status: [], genre: [], region: [], language: [], year: [], sort: ["date_desc"] });
                  }}
                  className="text-sm text-white/60 hover:text-red-400 hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.5)] transition-all duration-300"
                >
                  清空筛选
                </button>
              )}
              <span className="min-w-32 text-center text-sm px-4 py-1.5 bg-white/5 backdrop-blur-2xl rounded-full border border-white/10 text-white font-medium shadow-[0_4px_10px_rgba(0,0,0,0.2)] drop-shadow-[0_0_8px_rgba(255,255,255,0.1)] transition-all">
                {isLoading ? "加载中..." : requestError ? "加载失败" : `找到 ${total} 部作品`}
              </span>
            </div>
          </div>

          {requestError && (
            <div role="alert" className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {requestError}
            </div>
          )}

          <div
            className={`relative grid grid-cols-2 items-start gap-4 transition-opacity duration-200 sm:grid-cols-3 md:gap-6 lg:grid-cols-5 xl:grid-cols-6 ${
              isLoading && mediaItems.length === 0 ? "min-h-128" : ""
            } ${
              isLoading && mediaItems.length > 0 ? "opacity-60" : "opacity-100"
            }`}
            aria-busy={isLoading}
          >
            {/* Match the final page geometry while results are loading. */}
            {isLoading && mediaItems.length === 0 ? (
              [...Array(PAGE_SIZE)].map((_, i) => (
                <SearchMediaCardSkeleton key={`loading-initial-${i}`} />
              ))
            ) : requestError ? null : mediaItems.length > 0 ? (
              mediaItems.map((item) => (
                <SearchMediaCard key={`${item.type}-${item.id}`} item={item} returnHref={returnHref} />
              ))
            ) : (
              <div className="col-span-full py-20 text-center text-white/50 backdrop-blur-sm font-medium">
                暂无符合条件的作品
              </div>
            )}
          </div>
          
          {totalPages > 1 && !isLoading && (
            <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="搜索结果分页">
              <button onClick={() => goToPage(page - 1)} disabled={page === 1} className="glass-control rounded-xl p-2.5 text-white/65 transition-all hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30" aria-label="上一页">
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              {pageNumbers(page, totalPages).map((pageNumber) => (
                <button key={pageNumber} onClick={() => goToPage(pageNumber)} aria-current={pageNumber === page ? "page" : undefined} className={`min-w-10 rounded-xl border px-3 py-2 text-center text-sm transition-all ${pageNumber === page ? "border-red-400/30 bg-red-500/15 text-red-300" : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"}`}>
                  {pageNumber}
                </button>
              ))}
              <button onClick={() => goToPage(page + 1)} disabled={page === totalPages} className="glass-control rounded-xl p-2.5 text-white/65 transition-all hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30" aria-label="下一页">
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </nav>
          )}
        </main>
      </div>

      <button
        onClick={scrollToTop}
        className={`fixed bottom-22 right-4 z-50 flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 shadow-[0_4px_15px_rgba(0,0,0,0.2)] backdrop-blur-2xl transition-all duration-300 hover:scale-105 hover:border-red-400/50 hover:bg-white/10 hover:text-red-400 hover:shadow-[0_6px_25px_rgba(248,113,113,0.3)] hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.5)] sm:right-8 lg:right-12 ${
          showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
        }`}
      >
        <ArrowUp className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function SearchPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white/60">
          <LoaderCircle className="size-6 animate-spin text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]" aria-hidden="true" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
