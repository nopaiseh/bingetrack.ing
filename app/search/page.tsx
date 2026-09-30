import { notFound } from "next/navigation";
import SearchClient from "./SearchClient";
import { fetchSearchOptionsServer, hasOnlyKnownTagFilters } from "@/lib/functions/search-options";
import { searchCachedMedia } from "@/lib/functions/cached-media";
import { searchMediaServer } from "@/lib/functions/media-repo";
import { ApiValidationError, parseMediaSearchParams } from "@/lib/api/media-params";
import { buildMediaSearchQuery, hasOnlyKnownFilterValues } from "@/lib/api/search-state";
import { reportHandledError } from "@/lib/report-error";
import type { FetchMediaListOptions, MediaCard } from "@/lib/types";

/**
 * 只缓存第一页、无关键词、无年份范围，且类型／地区／语言各至多一个值的查询，对应详情页标签链接等常见入口；取值已在上游核对为现有选项。
 * 其余组合（翻页、年份、多选）直接查询：页面本身按请求渲染，不缓存不会产生写入，缓存它们反而让每个组合各写一条数据缓存。
 */
function isCacheableSearch(params: FetchMediaListOptions): boolean {
  const single = (value: string | null | undefined) => !value?.includes(",");
  return !params.q
    && !params.offset
    && !params.startYear
    && !params.endYear
    && single(params.genre)
    && single(params.region)
    && single(params.language);
}

/** 分类、状态、排序或类型／地区／语言含未知值时返回 404；否则将路由参数规范化为查询字符串，校验后读取首屏结果，再传给客户端搜索组件。 */
export default async function SearchPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  if (!hasOnlyKnownFilterValues(params)) notFound();
  const key = buildMediaSearchQuery(params);
  const initialOptions = await fetchSearchOptionsServer();
  // notFound() 以抛错实现，须放在下方 try 之外。
  const tags = new URLSearchParams(key);
  if (!hasOnlyKnownTagFilters({ genre: tags.get("genre"), region: tags.get("region"), language: tags.get("language") }, initialOptions)) notFound();

  let initialResult: { rows: MediaCard[]; total: number; key: string; error: string | null };
  try {
    const parsed = parseMediaSearchParams(new URLSearchParams(key));
    const data = isCacheableSearch(parsed) ? await searchCachedMedia(key) : await searchMediaServer(parsed);
    initialResult = { ...data, key, error: null };
  } catch (error) {
    // 与客户端请求保持一致：参数无效提示检查条件，其他失败提示稍后重试。
    const invalid = error instanceof ApiValidationError;
    if (!invalid) reportHandledError("Initial search failed:", error);
    initialResult = {
      rows: [],
      total: 0,
      key,
      error: invalid ? "搜索条件无效，请检查搜索词和筛选条件。" : "暂时无法加载搜索结果，请稍后重试。",
    };
  }
  return <SearchClient key={key} initialOptions={initialOptions} initialResult={initialResult} />;
}
