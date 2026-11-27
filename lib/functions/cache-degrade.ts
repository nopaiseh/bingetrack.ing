import { connection } from "next/server";

/**
 * 系列／同系列查询失败时，在 unstable_cache 回调内抛出，避免把空系列写入缓存。
 * 外层用 cachedWithSeriesFallback 接住后走无缓存路径，返回空系列并照常上报。
 */
export class SeriesDegradedError extends Error {
  constructor(message = "Series query degraded; skip unstable_cache write") {
    super(message);
    this.name = "SeriesDegradedError";
  }
}

export function isSeriesDegradedError(error: unknown): error is SeriesDegradedError {
  return error instanceof SeriesDegradedError;
}

/** 读库结果：seriesDegraded 表示系列或同系列查询失败并已降级。 */
export type DetailFetchResult<T> = {
  value: T;
  seriesDegraded: boolean;
};

/**
 * 系列降级时调用：本请求退出 Full Route Cache／ISR 写入。
 *
 * 依据（Next.js 16.4、未启用 cacheComponents，仍用 `export const revalidate`）：
 * - 官方推荐用 `connection()` 替代 `unstable_noStore`，在请求时渲染、不把结果写入全路由缓存
 *   （见 `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md`）。
 * - 必须在 `unstable_cache` 回调之外调用；缓存回调内使用会抛错
 *   （见 unstable_cache 文档 Unsupported operations）。
 * - 经典 ISR 的 on-demand／后台再生走 prerender-legacy：`connection()` 会抛出
 *   DynamicServerError，由 Next 捕获后改走动态渲染，从而**不会**把空系列页写入 ISR。
 *   这不是构建失败，也不同于在错误异步上下文里误用 cookies/headers 导致的未捕获错误。
 * - 正常（未降级）路径不调用本函数，详情页原有 revalidate／tag 失效行为不变。
 */
export async function skipFullRouteCacheForSeriesDegrade(): Promise<void> {
  await connection();
}

/**
 * 先跑 unstable_cache 包装的加载；若抛 SeriesDegradedError 则不写入数据缓存，
 * 并退出本请求的 Full Route Cache，再无缓存重跑一次（返回空系列／空同系列条目，
 * 并照常 reportHandledError）。
 */
export async function cachedWithSeriesFallback<T>(
  runCached: () => Promise<T>,
  runUncached: () => Promise<T>,
): Promise<T> {
  try {
    return await runCached();
  } catch (error) {
    if (isSeriesDegradedError(error)) {
      await skipFullRouteCacheForSeriesDegrade();
      return runUncached();
    }
    throw error;
  }
}

/** 供缓存回调：系列降级则抛 SeriesDegradedError，成功则返回 value。 */
export function throwIfSeriesDegraded<T>(result: DetailFetchResult<T>): T {
  if (result.seriesDegraded) throw new SeriesDegradedError();
  return result.value;
}
