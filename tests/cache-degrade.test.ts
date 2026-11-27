import { beforeEach, describe, expect, it, vi } from "vitest";

const connection = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("next/server", () => ({
  connection: () => connection(),
}));

const { SeriesDegradedError, cachedWithSeriesFallback, skipFullRouteCacheForSeriesDegrade, throwIfSeriesDegraded } =
  await import("@/lib/functions/cache-degrade");

describe("cache-degrade：系列降级退出 Full Route Cache", () => {
  beforeEach(() => {
    connection.mockClear();
  });

  it("skipFullRouteCacheForSeriesDegrade 调用 connection()", async () => {
    await skipFullRouteCacheForSeriesDegrade();
    expect(connection).toHaveBeenCalledTimes(1);
  });

  it("降级时先 connection() 再走无缓存路径，成功路径不调用", async () => {
    const runCached = vi.fn().mockRejectedValueOnce(new SeriesDegradedError());
    const runUncached = vi.fn().mockResolvedValueOnce({ series: [] });

    expect(await cachedWithSeriesFallback(runCached, runUncached)).toEqual({ series: [] });
    expect(connection).toHaveBeenCalledTimes(1);
    expect(runUncached).toHaveBeenCalledTimes(1);

    connection.mockClear();
    runCached.mockResolvedValueOnce({ series: ["甲"] });
    expect(await cachedWithSeriesFallback(runCached, runUncached)).toEqual({ series: ["甲"] });
    expect(connection).not.toHaveBeenCalled();
    expect(runUncached).toHaveBeenCalledTimes(1);
  });

  it("非 SeriesDegradedError 原样抛出且不调用 connection()", async () => {
    const boom = new Error("db down");
    await expect(
      cachedWithSeriesFallback(
        () => Promise.reject(boom),
        async () => null,
      ),
    ).rejects.toBe(boom);
    expect(connection).not.toHaveBeenCalled();
  });

  it("throwIfSeriesDegraded：降级抛错，成功返回 value", () => {
    expect(() => throwIfSeriesDegraded({ value: 1, seriesDegraded: true })).toThrow(SeriesDegradedError);
    expect(throwIfSeriesDegraded({ value: 2, seriesDegraded: false })).toBe(2);
  });
});
