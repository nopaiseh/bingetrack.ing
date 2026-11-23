import { describe, expect, it, vi } from "vitest";

const cacheSpecs = vi.hoisted(() => [] as Array<{ keys: unknown; options: unknown }>);

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown, keys: unknown, options: unknown) => {
    cacheSpecs.push({ keys, options });
    return typeof fn === "function" ? fn : () => fn;
  },
}));
vi.mock("@/lib/functions/media-repo", () => ({
  getMediaById: vi.fn(async () => null),
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
vi.mock("@/lib/functions/album-repo", () => ({ getAlbumDetail: vi.fn(async () => null) }));
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
const seasonId = "22222222-2222-4222-8222-222222222222";

const {
  getCachedMediaById,
  getCachedAlbumDetail,
  getCachedSeasonsBySeriesId,
  getCachedSeasonEpisodes,
  getCachedSeasonNextEpisodeNumber,
} = await import("@/lib/functions/cached-media");

const TAGS_LISTS = ["media", "media:lists"];
const TAGS_ITEM = ["media", `media:item:${mediaId}`];

describe("cached-media revalidate 策略", () => {
  it("仅后台写入可改的缓存使用 revalidate:false，靠 tag 失效", async () => {
    await getCachedMediaById(mediaId);
    await getCachedAlbumDetail(mediaId);
    await getCachedSeasonsBySeriesId(mediaId);
    await getCachedSeasonEpisodes(mediaId, seasonId, 1, 20);
    await getCachedSeasonNextEpisodeNumber(mediaId, seasonId);

    const byKey = Object.fromEntries(cacheSpecs.map((spec) => [String((spec.keys as string[])[0]), spec.options]));
    expect(byKey["public-media-detail-v3"]).toEqual({ revalidate: false, tags: TAGS_ITEM });
    expect(byKey["public-album-detail-v1"]).toEqual({ revalidate: false, tags: TAGS_ITEM });
    expect(byKey["public-media-seasons-v3"]).toEqual({ revalidate: false, tags: TAGS_ITEM });
    expect(byKey["public-season-episodes-v2"]).toEqual({ revalidate: false, tags: TAGS_ITEM });
    expect(byKey["public-season-next-episode-v1"]).toEqual({ revalidate: false, tags: TAGS_ITEM });
    expect(byKey["public-media-top-v4"]).toEqual({ revalidate: false, tags: TAGS_LISTS });
    expect(byKey["public-media-distributions-v2"]).toEqual({ revalidate: false, tags: TAGS_LISTS });
    expect(byKey["public-media-home-continue-v2"]).toEqual({ revalidate: false, tags: TAGS_LISTS });
    expect(byKey["public-media-currently-reading-v1"]).toEqual({ revalidate: false, tags: TAGS_LISTS });
    expect(byKey["public-media-release-year-stats-v2"]).toEqual({ revalidate: false, tags: TAGS_LISTS });
    expect(byKey["public-book-stats-v1"]).toEqual({ revalidate: false, tags: TAGS_LISTS });
    expect(byKey["public-album-stats-v1"]).toEqual({ revalidate: false, tags: TAGS_LISTS });
  });

  it("按日期变化的缓存保留定时重建", () => {
    const byKey = Object.fromEntries(cacheSpecs.map((spec) => [String((spec.keys as string[])[0]), spec.options]));
    expect(byKey["public-media-search-v3"]).toEqual({ revalidate: 3600, tags: TAGS_LISTS });
    expect(byKey["public-media-upcoming-v2"]).toEqual({ revalidate: 86400, tags: TAGS_LISTS });
  });
});
