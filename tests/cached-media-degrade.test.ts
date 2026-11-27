import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeriesDegradedError } from "@/lib/functions/cache-degrade";

const cacheStore = vi.hoisted(() => new Map<string, unknown>());
const cacheSpecs = vi.hoisted(() => [] as Array<{ keys: unknown; options: unknown }>);
const mediaForCache = vi.hoisted(() => vi.fn());
const mediaUncached = vi.hoisted(() => vi.fn());
const albumForCache = vi.hoisted(() => vi.fn());
const albumUncached = vi.hoisted(() => vi.fn());
const connection = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock("next/server", () => ({
  connection: () => connection(),
}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown, keys: unknown, options: unknown) => {
    cacheSpecs.push({ keys, options });
    const loader = typeof fn === "function" ? (fn as (...args: unknown[]) => Promise<unknown>) : async () => fn;
    return async (...args: unknown[]) => {
      const storeKey = JSON.stringify([keys, args]);
      if (cacheStore.has(storeKey)) return cacheStore.get(storeKey);
      const value = await loader(...args);
      cacheStore.set(storeKey, value);
      return value;
    };
  },
}));
vi.mock("@/lib/functions/media-repo", () => ({
  getMediaByIdForCache: (...args: unknown[]) => mediaForCache(...args),
  getMediaById: (...args: unknown[]) => mediaUncached(...args),
  getSeasonEpisodes: vi.fn(async () => null),
  getSeasonNextEpisodeNumber: vi.fn(async () => null),
  getSeasonsBySeriesId: vi.fn(async () => []),
  searchMediaServer: vi.fn(async () => ({ rows: [], total: 0 })),
  fetchTopMediaServer: vi.fn(async () => []),
  fetchMediaDistributionsServer: vi.fn(async () => ({})),
  fetchUpcomingReleasesServer: vi.fn(async () => []),
  getBookStats: vi.fn(async () => ({})),
  getAlbumStats: vi.fn(async () => ({})),
}));
vi.mock("@/lib/functions/album-repo", () => ({
  getAlbumDetailForCache: (...args: unknown[]) => albumForCache(...args),
  getAlbumDetail: (...args: unknown[]) => albumUncached(...args),
}));
vi.mock("@/lib/continue-watching", () => ({
  getHomeContinue: vi.fn(async () => ({ watching: [], listening: [], reading: [] })),
  getCurrentlyReading: vi.fn(async () => []),
}));
vi.mock("@/lib/supabase/public-server", () => ({
  getSupabasePublicServer: () => ({
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  }),
}));
vi.mock("@/lib/report-error", () => ({ reportHandledError: vi.fn() }));
vi.mock("@/lib/api/media-params", () => ({
  parseMediaSearchParams: vi.fn(() => ({})),
}));
vi.mock("@/lib/functions/retry", () => ({ withRetry: <T>(fn: () => T) => fn() }));

const mediaId = "11111111-1111-4111-8111-111111111111";

const { getCachedMediaById, getCachedAlbumDetail } = await import("@/lib/functions/cached-media");

describe("系列降级不写入缓存，成功后可正常命中", () => {
  beforeEach(() => {
    cacheStore.clear();
    cacheSpecs.length = 0;
    mediaForCache.mockReset();
    mediaUncached.mockReset();
    albumForCache.mockReset();
    albumUncached.mockReset();
    connection.mockClear();
  });

  it("影视：(a) 系列降级抛错不写数据缓存、connection 退出页面缓存、无缓存重跑；(b) 下次成功返回系列并缓存且不调 connection", async () => {
    const emptySeries = { id: mediaId, title: "影片", series: [] as string[] };
    const withSeries = { id: mediaId, title: "影片", series: ["系列甲"] };

    mediaForCache.mockRejectedValueOnce(new SeriesDegradedError());
    mediaUncached.mockResolvedValueOnce(emptySeries);

    expect(await getCachedMediaById(mediaId)).toEqual(emptySeries);
    expect(cacheStore.size).toBe(0);
    expect(connection).toHaveBeenCalledTimes(1);
    expect(mediaForCache).toHaveBeenCalledTimes(1);
    expect(mediaUncached).toHaveBeenCalledTimes(1);

    connection.mockClear();
    mediaForCache.mockResolvedValueOnce(withSeries);
    expect(await getCachedMediaById(mediaId)).toEqual(withSeries);
    expect(cacheStore.size).toBe(1);
    expect(connection).not.toHaveBeenCalled();
    expect(mediaForCache).toHaveBeenCalledTimes(2);
    expect(mediaUncached).toHaveBeenCalledTimes(1);

    expect(await getCachedMediaById(mediaId)).toEqual(withSeries);
    expect(mediaForCache).toHaveBeenCalledTimes(2);
    expect(connection).not.toHaveBeenCalled();
  });

  it("专辑：(a) 系列降级不写数据缓存且 connection 退出页面缓存；(b) 下次成功返回系列并缓存", async () => {
    const emptySeries = {
      media: { id: mediaId, title: "专辑", series: [] as string[] },
      series: [] as Array<{ name: string; position: number | null; items: unknown[] }>,
      artists: [],
      trackCount: 0,
      label: null,
      ratedCount: 0,
      ownership: null,
      tracks: [],
    };
    const withSeries = {
      ...emptySeries,
      media: { id: mediaId, title: "专辑", series: ["杰伦"] },
      series: [{ name: "杰伦", position: 1, items: [] }],
    };

    albumForCache.mockRejectedValueOnce(new SeriesDegradedError());
    albumUncached.mockResolvedValueOnce(emptySeries);

    expect(await getCachedAlbumDetail(mediaId)).toEqual(emptySeries);
    expect(cacheStore.size).toBe(0);
    expect(connection).toHaveBeenCalledTimes(1);
    expect(albumForCache).toHaveBeenCalledTimes(1);
    expect(albumUncached).toHaveBeenCalledTimes(1);

    connection.mockClear();
    albumForCache.mockResolvedValueOnce(withSeries);
    expect(await getCachedAlbumDetail(mediaId)).toEqual(withSeries);
    expect(cacheStore.size).toBe(1);
    expect(connection).not.toHaveBeenCalled();

    expect(await getCachedAlbumDetail(mediaId)).toEqual(withSeries);
    expect(albumForCache).toHaveBeenCalledTimes(2);
    expect(albumUncached).toHaveBeenCalledTimes(1);
    expect(connection).not.toHaveBeenCalled();
  });
});
