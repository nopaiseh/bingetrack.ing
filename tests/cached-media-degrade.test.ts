import { beforeEach, describe, expect, it, vi } from "vitest";
import { CacheSkipError } from "@/lib/functions/cache-degrade";

const cacheStore = vi.hoisted(() => new Map<string, unknown>());
const cacheSpecs = vi.hoisted(() => [] as Array<{ keys: unknown; options: unknown }>);
const mediaForCache = vi.hoisted(() => vi.fn());
const albumForCache = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
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

describe("详情缓存跳过降级结果", () => {
  beforeEach(() => {
    cacheStore.clear();
    cacheSpecs.length = 0;
    mediaForCache.mockReset();
    albumForCache.mockReset();
  });

  it("影视详情：降级结果返回调用方但不写入缓存；成功结果写入并可命中", async () => {
    const degraded = { id: mediaId, title: "降级", series: [] as string[] };
    const ok = { id: mediaId, title: "完整", series: ["系列甲"] };

    mediaForCache.mockImplementationOnce(async () => {
      throw new CacheSkipError(degraded);
    });
    expect(await getCachedMediaById(mediaId)).toEqual(degraded);
    expect(cacheStore.size).toBe(0);
    expect(mediaForCache).toHaveBeenCalledTimes(1);

    mediaForCache.mockResolvedValueOnce(ok);
    expect(await getCachedMediaById(mediaId)).toEqual(ok);
    expect(cacheStore.size).toBe(1);
    expect(mediaForCache).toHaveBeenCalledTimes(2);

    expect(await getCachedMediaById(mediaId)).toEqual(ok);
    expect(mediaForCache).toHaveBeenCalledTimes(2);
  });

  it("专辑详情：降级结果不缓存；成功结果缓存", async () => {
    const degraded = {
      media: { id: mediaId, title: "降级专辑", series: [] },
      series: [],
      artists: [],
      trackCount: 0,
      label: null,
      ratedCount: 0,
      ownership: null,
      tracks: [],
    };
    const ok = {
      ...degraded,
      media: { id: mediaId, title: "完整专辑", series: ["杰伦"] },
      series: [{ name: "杰伦", position: 1, items: [] }],
    };

    albumForCache.mockImplementationOnce(async () => {
      throw new CacheSkipError(degraded);
    });
    expect(await getCachedAlbumDetail(mediaId)).toEqual(degraded);
    expect(cacheStore.size).toBe(0);

    albumForCache.mockResolvedValueOnce(ok);
    expect(await getCachedAlbumDetail(mediaId)).toEqual(ok);
    expect(cacheStore.size).toBe(1);

    expect(await getCachedAlbumDetail(mediaId)).toEqual(ok);
    expect(albumForCache).toHaveBeenCalledTimes(2);
  });
});
