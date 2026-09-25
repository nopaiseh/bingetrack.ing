import SearchClient from "./SearchClient";
import { fetchSearchOptionsServer, type SearchOptions } from "@/lib/functions/search-options";
import { searchCachedMedia } from "@/lib/functions/cached-media";
import { searchMediaServer } from "@/lib/functions/media-repo";
import { ApiValidationError, parseMediaSearchParams } from "@/lib/api/media-params";
import { buildMediaSearchQuery } from "@/lib/api/search-state";
import { reportHandledError } from "@/lib/report-error";
import type { FetchMediaListOptions, MediaCard } from "@/lib/types";

/** 只缓存无关键词、且标签筛选均为已知选项的查询，使缓存键数量有界，避免任意参数填充数据缓存。 */
function isCacheableSearch(params: FetchMediaListOptions, options: SearchOptions): boolean {
  const within = (value: string | null | undefined, allowed: string[]) =>
    !value || value.split(",").every(/* 检查每个筛选值是否属于已知选项。 */ (item) => allowed.includes(item));
  return !params.q
    && within(params.genre, options.genres)
    && within(params.region, options.regions)
    && within(params.language, options.languages);
}

/** 将路由参数规范化为查询字符串，校验后读取首屏结果，再传给客户端搜索组件。 */
export default async function SearchPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  const key = buildMediaSearchQuery(params);
  const initialOptions = await fetchSearchOptionsServer();

  let initialResult: { rows: MediaCard[]; total: number; key: string; error: string | null };
  try {
    const parsed = parseMediaSearchParams(new URLSearchParams(key));
    const data = isCacheableSearch(parsed, initialOptions) ? await searchCachedMedia(key) : await searchMediaServer(parsed);
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
