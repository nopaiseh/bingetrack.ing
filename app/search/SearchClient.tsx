"use client";

import { useState, useEffect, Suspense, useCallback, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { MediaCard } from "@/lib/types";
import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/api/search-limits";
import type { SearchOptions } from "@/lib/functions/search-options";
import { PAGE_SIZE, readFilters, writeFilters, readSearchPage, buildMediaSearchQuery, type SearchFilters } from "@/lib/api/search-state";
import ActiveFilterBar from "@/components/search/ActiveFilterBar";
import SearchBar from "@/components/search/SearchBar";
import SearchFilterPanel from "@/components/search/SearchFilterPanel";
import SearchResultSection from "@/components/search/SearchResultSection";
import SearchScrollTop from "@/components/search/SearchScrollTop";
import { countActiveFilters, EMPTY_FILTERS, resultRange, resultsHeading } from "@/components/search/search-model";
import SearchLoading from "./loading";

type SearchProps = {
  initialOptions: SearchOptions;
  initialResult: { rows: MediaCard[]; total: number; key: string; error: string | null };
};

/** 以 URL 为筛选和分页状态来源，复用服务端首屏结果，并管理搜索、防抖请求和交互界面。 */
function SearchContent({ initialOptions, initialResult }: SearchProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const latestSearchParamsRef = useRef(searchParamsString);
  // 保存最新 URL 参数，供延迟执行的搜索回调读取。
  useEffect(() => {
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

  const [showAdvanced, setShowAdvanced] = useState(false);

  const { genres: genreOptions, regions: regionOptions, languages: languageOptions, years: yearOptions } = initialOptions;

  const [result, setResult] = useState(initialResult);
  const { rows: mediaItems, total } = result;
  const inputTooLong = query.trim().length > MAX_SEARCH_QUERY_LENGTH;
  const queryTooLong = urlQuery.trim().length > MAX_SEARCH_QUERY_LENGTH;
  const isLoading = !queryTooLong && result.key !== apiQuery;
  const requestError = queryTooLong ? null : isLoading ? null : result.error;
  const [showScrollTop, setShowScrollTop] = useState(false);
  const resultsRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // 写入目标页码并省略第一页参数，按需要新增或替换浏览器历史记录。
  const updatePage = useCallback((nextPage: number, replace = false) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");
    const href = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
    if (replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
  }, [pathname, searchParams]);

  // 根据新筛选状态重写 URL，并删除页码以从第一页重新搜索。
  const setFilters = useCallback((
    update: SearchFilters | ((previous: SearchFilters) => SearchFilters),
  ) => {
    const nextFilters = typeof update === "function" ? update(filters) : update;
    const params = new URLSearchParams(searchParams.toString());
    writeFilters(params, nextFilters);
    params.delete("page");
    const href = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
    window.history.replaceState(null, "", href);
  }, [filters, pathname, searchParams]);

  // 输入词与 URL 不一致时安排 300 毫秒防抖更新；恢复历史 URL 时不重置页码。
  useEffect(() => {
    // 从历史 URL 恢复搜索时保留页码；只有输入变化才在防抖结束后回到第一页。
    if (inputTooLong || query.trim() === urlQuery.trim()) return;
    // 将最新输入合并到当前 URL，清除旧页码，且只在参数改变时替换地址。
    const timeoutId = window.setTimeout(() => {
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
    // 清除尚未触发的防抖计时器。
    return () => window.clearTimeout(timeoutId);
  }, [pathname, query, urlQuery, inputTooLong]);

  // 导航栏在搜索页隐藏自己的输入框，⌘K 与 / 改为聚焦页内搜索框。
  useEffect(() => {
    const onFocusSearch = () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener("bingetrack:focus-search", onFocusSearch);
    return () => window.removeEventListener("bingetrack:focus-search", onFocusSearch);
  }, []);

  // 监听滚动位置以控制回到顶部按钮，并在清理时移除监听器。
  useEffect(() => {
    /** 滚动超过 500 像素时显示回到顶部按钮。 */
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    // 移除滚动事件监听，避免组件卸载后继续更新状态。
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /** 平滑滚动到页面顶部。 */
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 查询键变化时请求新结果，并在查询再次变化或卸载时取消旧请求。
  useEffect(() => {
    // 首屏结果与查询一致时不重复请求；换页期间保留旧卡片，查询变化时取消旧请求。
    if (queryTooLong || result.key === apiQuery) return;
    const controller = new AbortController();
    /** 请求媒体 API；成功时写入卡片和总数，失败时显示错误，忽略已取消请求的结果。 */
    const fetchMedia = async () => {
      try {
        const res = await fetch(`/api/media?${apiQuery}`, { signal: controller.signal });
        if (res.status === 400) {
          if (!controller.signal.aborted) setResult({ rows: [], total: 0, key: apiQuery, error: "搜索条件无效，请检查搜索词和筛选条件。" });
          return;
        }
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
    // 取消已过期的媒体搜索请求。
    return () => controller.abort();
  }, [apiQuery, result.key, queryTooLong]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(/* 成功加载后若当前页超出末页，将 URL 替换为最后一个有效页码。 */ () => {
    if (!isLoading && !requestError && page > totalPages) updatePage(totalPages, true);
  }, [isLoading, requestError, page, totalPages, updatePage]);

  /** 切换结果页，并平滑滚动到搜索结果区域。 */
  const goToPage = (nextPage: number) => {
    updatePage(nextPage);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const hasActiveFilters = Object.entries(filters).some(/* 判断是否存在非排序筛选；年份只在至少一个端点有值时算启用。 */ ([key, arr]) => {
    if (key === "sort") return false;
    if (key === "year") return arr.length > 0 && (arr[0] !== "" || arr[1] !== "");
    return arr.length > 0;
  });

  const hasActiveAdvancedFilters = Boolean(
    (filters.genre?.length ?? 0) > 0 ||
    (filters.region?.length ?? 0) > 0 ||
    (filters.language?.length ?? 0) > 0 ||
    (filters.year?.length > 0 && (filters.year[0] !== "" || filters.year[1] !== ""))
  );

  const activeFilterCount = countActiveFilters(filters);
  const canResetSearch = activeFilterCount > 0 || urlQuery.trim().length > 0;

  /** 清空搜索词和全部筛选，让无结果状态能回到完整目录。 */
  const clearSearchConditions = () => {
    setQuery("");
    setFilters(EMPTY_FILTERS);
  };

  /** 用一个起步方向替换当前关键词和筛选。 */
  const suggestFilters = (partial: Partial<Pick<SearchFilters, "type" | "status">>) => {
    setQuery("");
    setFilters({ ...EMPTY_FILTERS, ...partial });
  };

  const heading = resultsHeading(urlQuery.trim(), total, isLoading || Boolean(requestError));
  const rangeLabel = resultRange(page, isLoading || requestError ? 0 : total);

  return (
    <div className="text-fg pt-24 pb-8 md:pb-12 selection:bg-[var(--accent-soft)] selection:text-white font-sans relative">
      <div className="container relative z-1 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section ref={resultsRef} className="w-full scroll-mt-24" aria-labelledby="search-results-heading">
          <h1 id="search-results-heading" className="text-balance text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            {heading}
          </h1>
          <p className="mt-2 text-sm text-fg-muted">
            {isLoading ? "加载中..." : requestError ? "加载失败" : `找到 ${total} 部作品`}
          </p>

          <div className="mb-8 mt-6">
            <SearchBar
              query={query}
              onQueryChange={setQuery}
              onClearQuery={() => setQuery("")}
              inputRef={searchInputRef}
              inputTooLong={inputTooLong}
              maxLength={MAX_SEARCH_QUERY_LENGTH}
              showAdvanced={showAdvanced}
              hasActiveAdvancedFilters={hasActiveAdvancedFilters}
              onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
            />
            <SearchFilterPanel
              filters={filters}
              setFilters={setFilters}
              advancedVisible={showAdvanced}
              genreOptions={genreOptions}
              regionOptions={regionOptions}
              languageOptions={languageOptions}
              yearOptions={yearOptions}
              panelRef={filterPanelRef}
            />
            {hasActiveFilters && (
              <ActiveFilterBar
                filters={filters}
                setFilters={setFilters}
                genreOptions={genreOptions}
                regionOptions={regionOptions}
                languageOptions={languageOptions}
              />
            )}
          </div>

          <SearchResultSection
            filters={filters}
            mediaItems={mediaItems}
            total={total}
            page={page}
            totalPages={totalPages}
            isLoading={isLoading}
            requestError={requestError}
            queryTooLong={queryTooLong}
            rangeLabel={rangeLabel}
            returnHref={returnHref}
            canResetSearch={canResetSearch}
            urlQuery={urlQuery.trim()}
            onRetry={() => setResult({ ...result, key: "", error: null })}
            onReset={clearSearchConditions}
            onSuggest={suggestFilters}
            onPage={goToPage}
          />
        </section>
      </div>

      <SearchScrollTop visible={showScrollTop} onClick={scrollToTop} />
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
