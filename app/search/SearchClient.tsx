"use client";

import { useState, useEffect, Suspense, useCallback, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { MediaCard } from "@/lib/types";
import type { SearchOptions } from "@/lib/functions/search-options";
import { PAGE_SIZE, readFilters, writeFilters, readSearchPage, buildMediaSearchQuery, type SearchFilters } from "@/lib/api/search-state";

import { SearchMediaCard, SearchMediaCardSkeleton } from "@/components/SearchMediaCard";
import SearchLoading from "./loading";

type SearchProps = {
  initialOptions: SearchOptions;
  initialResult: { rows: MediaCard[]; total: number; key: string; error: string | null };
};

/** 生成最多五个连续页码，靠近首尾页时调整窗口以避免越界。 */
function pageNumbers(current: number, total: number) {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: end - start + 1 }, /* 将窗口内的索引转换为实际页码。 */ (_, index) => start + index);
}

/** 以 URL 为筛选和分页状态来源，复用服务端首屏结果，并管理搜索、防抖请求和交互界面。 */
function SearchContent({ initialOptions, initialResult }: SearchProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const latestSearchParamsRef = useRef(searchParamsString);
  useEffect(/* 保存最新 URL 参数，供延迟执行的搜索回调读取。 */ () => {
    latestSearchParamsRef.current = searchParamsString;
  }, [searchParamsString]);
  const urlQuery = searchParams.get("q") || "";
  const page = readSearchPage(new URLSearchParams(searchParamsString));
  const apiQuery = buildMediaSearchQuery(new URLSearchParams(searchParamsString));
  const returnHref = searchParams.size > 0 ? `${pathname}?${searchParamsString}` : pathname;

  const [query, setQuery] = useState(urlQuery);
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);

  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
    setQuery(urlQuery);
  }

  const filters = useMemo(
    /** 按当前 URL 参数计算筛选状态，参数未变时复用结果。 */
    () => readFilters(new URLSearchParams(searchParamsString)),
    [searchParamsString],
  );

  const [showAdvanced, setShowAdvanced] = useState(true);

  const { genres: genreOptions, regions: regionOptions, languages: languageOptions, years: yearOptions } = initialOptions;

  const [result, setResult] = useState(initialResult);
  const { rows: mediaItems, total } = result;
  const isLoading = result.key !== apiQuery;
  const requestError = isLoading ? null : result.error;
  const [showScrollTop, setShowScrollTop] = useState(false);
  const resultsRef = useRef<HTMLElement | null>(null);

  const updatePage = useCallback(/* 写入目标页码并省略第一页参数，按需要新增或替换浏览器历史记录。 */ (nextPage: number, replace = false) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");
    const href = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
    if (replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
  }, [pathname, searchParams]);

  const setFilters = useCallback(/* 根据新筛选状态重写 URL，并删除页码以从第一页重新搜索。 */ (
    update: SearchFilters | ((previous: SearchFilters) => SearchFilters),
  ) => {
    const nextFilters = typeof update === "function" ? update(filters) : update;
    const params = new URLSearchParams(searchParams.toString());
    writeFilters(params, nextFilters);
    params.delete("page");
    const href = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
    window.history.replaceState(null, "", href);
  }, [filters, pathname, searchParams]);

  useEffect(/* 输入词与 URL 不一致时安排 300 毫秒防抖更新；恢复历史 URL 时不重置页码。 */ () => {
    // 从历史 URL 恢复搜索时保留页码；只有输入变化才在防抖结束后回到第一页。
    if (query.trim() === urlQuery.trim()) return;
    const timeoutId = window.setTimeout(/* 将最新输入合并到当前 URL，清除旧页码，且只在参数改变时替换地址。 */ () => {
      const currentParams = latestSearchParamsRef.current;
      const params = new URLSearchParams(currentParams);
      if (query.trim()) params.set("q", query.trim());
      else params.delete("q");
      params.delete("page");
      const href = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
      if (params.toString() !== currentParams) {
        window.history.replaceState(null, "", href);
      }
    }, 300);
    return /* 清除尚未触发的防抖计时器。 */ () => window.clearTimeout(timeoutId);
  }, [pathname, query, urlQuery]);

  useEffect(/* 监听滚动位置以控制回到顶部按钮，并在清理时移除监听器。 */ () => {
    /** 滚动超过 500 像素时显示回到顶部按钮。 */
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return /* 移除滚动事件监听，避免组件卸载后继续更新状态。 */ () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /** 平滑滚动到页面顶部。 */
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(/* 查询键变化时请求新结果，并在查询再次变化或卸载时取消旧请求。 */ () => {
    // 首屏结果与查询一致时不重复请求；换页期间保留旧卡片，查询变化时取消旧请求。
    if (result.key === apiQuery) return;
    const controller = new AbortController();
    /** 请求媒体 API；成功时写入卡片和总数，失败时显示错误，忽略已取消请求的结果。 */
    const fetchMedia = async () => {
      try {
        const res = await fetch(`/api/media?${apiQuery}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`MediaCard request failed with status ${res.status}`);
        const json: { rows?: MediaCard[]; total?: number } = await res.json();
        if (!controller.signal.aborted) {
          setResult({ rows: json.rows ?? [], total: json.total ?? 0, key: apiQuery, error: null });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch media:", error);
        setResult({ rows: [], total: 0, key: apiQuery, error: "暂时无法加载搜索结果，请稍后重试。" });
      }
    };
    void fetchMedia();
    return /* 取消已过期的媒体搜索请求。 */ () => controller.abort();
  }, [apiQuery, result.key]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(/* 成功加载后若当前页超出末页，将 URL 替换为最后一个有效页码。 */ () => {
    if (!isLoading && !requestError && page > totalPages) updatePage(totalPages, true);
  }, [isLoading, requestError, page, totalPages, updatePage]);

  /** 切换结果页，并平滑滚动到搜索结果区域。 */
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

  /** 根据点击项更新单选或多选筛选；全部选中时用空数组表示不限制。 */
  const toggleFilter = (categoryId: string, value: string, isMultiSelect = true, allOptions: string[] = []) => {
    setFilters(/* 基于此前选项切换当前值，并将全选状态折叠为无筛选。 */ (prev) => {
      const currentSelected = prev[categoryId] || [];
      if (value === "全部") return { ...prev, [categoryId]: [] };
      if (!isMultiSelect) return { ...prev, [categoryId]: [value] };

      if (currentSelected.includes(value)) {
        return { ...prev, [categoryId]: currentSelected.filter(/* 从已选列表中移除再次点击的选项。 */ (item) => item !== value) };
      } else {
        const newSelected = [...currentSelected, value];
        const hasSelectedAll = allOptions.length > 0 && allOptions.every(/* 判断该分类的所有可选值是否均已选中。 */ (opt) => newSelected.includes(opt));
        if (hasSelectedAll) return { ...prev, [categoryId]: [] };
        return { ...prev, [categoryId]: newSelected };
      }
    });
  };

  /** 同一排序字段再次点击时反转方向，切换字段时默认降序。 */
  const handleSortToggle = (fieldId: string) => {
    setFilters(/* 根据旧排序值生成下一次排序字段与方向。 */ (prev) => {
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

  /** 更新起始或结束年份；出现倒置范围时将另一端同步到新值。 */
  const handleYearChange = (type: "start" | "end", value: string) => {
    setFilters(/* 保留未修改的年份端点，必要时调整另一端，确保起始年份不晚于结束年份。 */ (prev) => {
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

  const hasActiveFilters = Object.entries(filters).some(/* 判断是否存在非排序筛选；年份只在至少一个端点有值时算启用。 */ ([key, arr]) => {
    if (key === "sort") return false;
    if (key === "year") return arr.length > 0 && (arr[0] !== "" || arr[1] !== "");
    return arr.length > 0;
  });

  const SORT_OPTIONS = [
    { id: "date", label: "日期" },
    { id: "rating", label: "评分" },
  ];

  return (
    <div className="min-h-screen text-white/90 pt-24 pb-12 selection:bg-red-500/30 selection:text-white font-sans relative">
      <div className="container relative z-1 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        <div className="mb-8">
          <div className="group relative grid gap-2 sm:block">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-5">
                <span className="i-material-symbols-search-rounded inline-block size-4 text-white/50 group-focus-within:text-white group-focus-within:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] transition-all duration-300" aria-hidden="true" />
              </div>

              <input
                aria-label="搜索媒体"
                value={query}
                onChange={/* 将搜索输入框内容写入本地输入状态。 */ (e) => {
                  setQuery(e.target.value);
                }}
                placeholder="搜索电影、电视剧、导演或演员..."
                className="surface-control relative z-0 w-full rounded-2xl py-4 pl-12 pr-12 text-base text-white outline-none transition-all duration-300 placeholder:text-white/50 sm:py-5 sm:pr-40 sm:text-lg"
              />
            </div>

            <div className="z-10 flex min-h-11 items-center justify-end gap-3 sm:absolute sm:inset-y-0 sm:right-0 sm:pr-4">
              {query && (
                <button onClick={/* 清空搜索词，后续由防抖逻辑同步到 URL。 */ () => {
                  setQuery("");
                }} className="text-white/50 hover:text-red-400 hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.6)] transition-all duration-300" aria-label="清除搜索">
                  <span className="i-material-symbols-close-rounded inline-block size-5" aria-hidden="true" />
                </button>
              )}
              <div className="hidden h-6 w-px bg-white/20 sm:block"></div>
              
              <button
                onClick={/* 切换高级筛选区域的展开状态。 */ () => setShowAdvanced(!showAdvanced)}
                className={`relative flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300 backdrop-blur-2xl ${
                  showAdvanced
                    ? "surface-active text-red-400 border border-red-400/40 shadow-[0_4px_15px_rgba(248,113,113,0.2)] drop-shadow-[0_0_3px_rgba(248,113,113,0.3)]"
                    : "filter-option"
                }`}
              >
                <span className="i-material-symbols-tune-rounded inline-block size-4" aria-hidden="true" />
                {showAdvanced ? "收起筛选" : "高级筛选"}
                {!showAdvanced && hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full border border-black/50 shadow-[0_0_8px_rgba(248,113,113,0.8)] animate-pulse"></span>
                )}
              </button>
            </div>
          </div>

          {showAdvanced && (
            <div className="surface-panel mt-4 origin-top rounded-2xl p-4 transition-all duration-300 animate-in slide-in-from-top-2 fade-in sm:p-6">
              <div className="flex flex-col">
                {BUTTON_CATEGORIES.map(/* 为每个筛选分类生成全部按钮与具体选项，并计算当前选中状态。 */ (category) => {
                  const activeSelections = filters[category.id] || [];
                  const isAllSelected = activeSelections.length === 0;

                  return (
                    <div key={category.id} className="flex flex-col items-start gap-3 border-b border-white/10 py-4 sm:flex-row sm:gap-0">
                      <span className="text-white/60 text-sm font-medium w-16 shrink-0 mt-1.5 tracking-wider drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">
                        {category.label}
                      </span>
                      <div className="flex flex-wrap gap-x-3 gap-y-2 flex-1 items-center">
                        <button
                          onClick={/* 清除当前分类的限制。 */ () => toggleFilter(category.id, "全部", category.multiSelect, category.options)}
                          className={`min-h-10 rounded-lg px-4 py-1.5 text-[13px] transition-all duration-300 backdrop-blur-2xl ${
                            isAllSelected
                              ? "filter-option-active"
                              : "filter-option"
                          }`}
                        >
                          全部
                        </button>

                        {category.options.map(/* 渲染一个分类选项按钮，并标示其是否选中。 */ (option) => {
                          const isSelected = activeSelections.includes(option);
                          return (
                            <button
                              key={option}
                              onClick={/* 按该分类的单选或多选规则切换当前选项。 */ () => toggleFilter(category.id, option, category.multiSelect, category.options)}
                              className={`group flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-1.5 text-[13px] transition-all duration-300 backdrop-blur-2xl ${
                                isSelected
                                  ? "filter-option-active"
                                  : "filter-option"
                              }`}
                            >
                              {option}
                              {isSelected && (
                                <span className="i-material-symbols-close-rounded ml-1 inline-block size-3 opacity-60 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
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
                      onClick={/* 清除起止年份筛选。 */ () => {
                        setFilters(/* 保留其他筛选项，只将年份范围清空。 */ (prev) => ({ ...prev, year: [] }));
                      }}
                      className={`min-h-10 rounded-lg px-4 py-1.5 text-[13px] transition-all duration-300 backdrop-blur-2xl ${
                        !filters.year?.length || (filters.year[0] === "" && filters.year[1] === "")
                          ? "filter-option-active"
                          : "filter-option"
                      }`}
                    >
                      全部
                    </button>

                    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:w-auto">
                      <div className="relative group">
                        <select
                          aria-label="开始年份"
                          value={filters.year?.[0] || ""}
                          onChange={/* 将选择的值作为起始年份交给范围校正逻辑。 */ (e) => handleYearChange("start", e.target.value)}
                          className="filter-option min-h-10 w-full min-w-0 cursor-pointer appearance-none rounded-lg py-1.5 pl-3 pr-8 text-[13px] backdrop-blur-2xl transition-all outline-none focus:border-white/40 focus:bg-white/10 sm:min-w-25"
                        >
                          <option value="" disabled hidden className="bg-neutral-900 text-neutral-300">开始年份</option>
                          {yearOptions.map(/* 将年份渲染为起始年份下拉选项。 */ (y) => (
                            <option key={y} value={y} className="bg-neutral-900 text-neutral-300">{y}</option>
                          ))}
                        </select>
                        <span className="i-material-symbols-expand-more-rounded absolute right-3 top-1/2 inline-block size-3 -translate-y-1/2 text-white/50 group-hover:text-white pointer-events-none transition-colors" aria-hidden="true" />
                      </div>

                      <span className="text-white/60 text-[13px] font-medium px-1">至</span>

                      <div className="relative group">
                        <select
                          aria-label="结束年份"
                          value={filters.year?.[1] || ""}
                          onChange={/* 将选择的值作为结束年份交给范围校正逻辑。 */ (e) => handleYearChange("end", e.target.value)}
                          className="filter-option min-h-10 w-full min-w-0 cursor-pointer appearance-none rounded-lg py-1.5 pl-3 pr-8 text-[13px] backdrop-blur-2xl transition-all outline-none focus:border-white/40 focus:bg-white/10 sm:min-w-25"
                        >
                          <option value="" disabled hidden className="bg-neutral-900 text-neutral-300">最终年份</option>
                          {yearOptions.map(/* 将年份渲染为结束年份下拉选项。 */ (y) => (
                            <option key={y} value={y} className="bg-neutral-900 text-neutral-300">{y}</option>
                          ))}
                        </select>
                        <span className="i-material-symbols-expand-more-rounded absolute right-3 top-1/2 inline-block size-3 -translate-y-1/2 text-white/50 group-hover:text-white pointer-events-none transition-colors" aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:gap-0">
                  <span className="text-white/60 text-sm font-medium w-16 shrink-0 mt-1.5 tracking-wider drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">
                    排序
                  </span>
                  <div className="flex flex-wrap gap-x-3 gap-y-2 flex-1 items-center">
                    {SORT_OPTIONS.map(/* 渲染排序按钮，并根据当前字段和方向显示选中状态。 */ (option) => {
                      const currentSort = filters.sort?.[0] || "date_desc";
                      const [currentField, currentOrder] = currentSort.split("_");
                      const isSelected = currentField === option.id;

                      return (
                        <button
                          key={option.id}
                          onClick={/* 切换点击字段的排序方向。 */ () => handleSortToggle(option.id)}
                          className={`group flex min-h-10 items-center gap-2 rounded-lg px-4 py-1.5 text-[13px] transition-all duration-300 backdrop-blur-2xl ${
                            isSelected
                              ? "filter-option-active"
                              : "filter-option"
                          }`}
                        >
                          {option.label}
                          {isSelected && (
                            currentOrder === "desc" ? <span className="i-material-symbols-arrow-downward-rounded inline-block size-3" aria-hidden="true" /> : <span className="i-material-symbols-arrow-upward-rounded inline-block size-3" aria-hidden="true" />
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

        <section ref={resultsRef} className="w-full scroll-mt-24" aria-labelledby="search-results-heading">
          <div className="mb-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <h2 id="search-results-heading" className="text-2xl font-bold text-white tracking-wide drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
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
                  onClick={/* 清空所有筛选并恢复默认日期降序。 */ () => {
                    setFilters({ type: [], status: [], genre: [], region: [], language: [], year: [], sort: ["date_desc"] });
                  }}
                  className="text-sm text-white/60 hover:text-red-400 hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.5)] transition-all duration-300"
                >
                  清空筛选
                </button>
              )}
              <span className="surface-muted min-w-32 rounded-full border border-white/10 px-4 py-1.5 text-center text-sm font-medium text-white shadow-[0_4px_10px_rgba(0,0,0,0.2)] backdrop-blur-2xl drop-shadow-[0_0_8px_rgba(255,255,255,0.1)] transition-all">
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
            {isLoading && mediaItems.length === 0 ? (
              [...Array(PAGE_SIZE)].map(/* 为首轮搜索加载生成一张占位卡片。 */ (_, i) => (
                <SearchMediaCardSkeleton key={`loading-initial-${i}`} />
              ))
            ) : requestError ? null : mediaItems.length > 0 ? (
              mediaItems.map(/* 将搜索结果渲染为卡片，并携带当前地址作为详情页返回路径。 */ (item) => (
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
              <button onClick={/* 返回上一页搜索结果。 */ () => goToPage(page - 1)} disabled={page === 1} className="surface-control rounded-xl p-2.5 text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30" aria-label="上一页">
                <span className="i-material-symbols-chevron-left-rounded inline-block size-4" aria-hidden="true" />
              </button>
              {pageNumbers(page, totalPages).map(/* 将页码窗口中的一页渲染为分页按钮。 */ (pageNumber) => (
                <button key={pageNumber} onClick={/* 跳转到点击的结果页。 */ () => goToPage(pageNumber)} aria-current={pageNumber === page ? "page" : undefined} className={`min-w-10 rounded-xl border px-3 py-2 text-center text-sm transition-all ${pageNumber === page ? "surface-active border-red-400/40 text-red-400 font-bold shadow-[0_4px_10px_rgba(248,113,113,0.2)]" : "surface-muted border-white/10 text-white/70 hover:bg-white/10 hover:text-white"}`}>
                  {pageNumber}
                </button>
              ))}
              <button onClick={/* 前往下一页搜索结果。 */ () => goToPage(page + 1)} disabled={page === totalPages} className="surface-control rounded-xl p-2.5 text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30" aria-label="下一页">
                <span className="i-material-symbols-chevron-right-rounded inline-block size-4" aria-hidden="true" />
              </button>
            </nav>
          )}
        </section>
      </div>

      <button
        onClick={scrollToTop}
        aria-label="返回页面顶部"
        className={`surface-muted fixed bottom-22 right-4 z-50 flex size-12 items-center justify-center rounded-full border border-white/10 text-white/70 shadow-[0_4px_15px_rgba(0,0,0,0.2)] backdrop-blur-2xl transition-all duration-300 hover:scale-105 hover:border-red-400/50 hover:bg-white/10 hover:text-red-400 hover:shadow-[0_6px_25px_rgba(248,113,113,0.3)] hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.5)] sm:right-8 lg:right-12 ${
          showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
        }`}
      >
        <span className="i-material-symbols-arrow-upward-rounded inline-block size-5" aria-hidden="true" />
      </button>
    </div>
  );
}

/** 为读取 URL 参数的搜索组件提供 Suspense 边界及等待指示器。 */
export default function SearchClient(props: SearchProps) {
  return (
    <Suspense fallback={<SearchLoading />}>
      <SearchContent {...props} />
    </Suspense>
  );
}

