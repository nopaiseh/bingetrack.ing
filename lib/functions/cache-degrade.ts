/**
 * 详情子查询降级时：仍把兜底结果返回给调用方，但禁止写入 unstable_cache。
 * 在缓存回调内抛出本错误；外层用 cachedUnlessDegraded 接住并返回 value。
 */
export class CacheSkipError<T = unknown> extends Error {
  readonly value: T;

  constructor(value: T) {
    super("Degraded detail result; skip unstable_cache write");
    this.name = "CacheSkipError";
    this.value = value;
  }
}

export function isCacheSkipError(error: unknown): error is CacheSkipError {
  return error instanceof CacheSkipError;
}

/** 读库结果：degraded 表示有子查询失败并已降级，此类结果不应进 unstable_cache。 */
export type DetailFetchResult<T> = {
  value: T;
  degraded: boolean;
};

/**
 * 跑 unstable_cache 包装的函数；若内部抛 CacheSkipError，则不缓存但仍返回其 value。
 * 其它错误原样抛出。
 */
export async function cachedUnlessDegraded<T>(runCached: () => Promise<T>): Promise<T> {
  try {
    return await runCached();
  } catch (error) {
    if (isCacheSkipError(error)) return error.value as T;
    throw error;
  }
}

/** 供缓存回调：降级则抛 CacheSkipError，成功则返回 value。 */
export function throwIfDegraded<T>(result: DetailFetchResult<T>): T {
  if (result.degraded) throw new CacheSkipError(result.value);
  return result.value;
}
