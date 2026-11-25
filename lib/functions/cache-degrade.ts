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
 * 先跑 unstable_cache 包装的加载；若抛 SeriesDegradedError 则不写入缓存，
 * 再无缓存重跑一次（返回空系列／空同系列条目，并照常 reportHandledError）。
 */
export async function cachedWithSeriesFallback<T>(
  runCached: () => Promise<T>,
  runUncached: () => Promise<T>,
): Promise<T> {
  try {
    return await runCached();
  } catch (error) {
    if (isSeriesDegradedError(error)) return runUncached();
    throw error;
  }
}

/** 供缓存回调：系列降级则抛 SeriesDegradedError，成功则返回 value。 */
export function throwIfSeriesDegraded<T>(result: DetailFetchResult<T>): T {
  if (result.seriesDegraded) throw new SeriesDegradedError();
  return result.value;
}
