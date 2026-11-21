import { describe, expect, it, vi } from "vitest";

const cacheSpecs = vi.hoisted(() => [] as Array<{ fn: unknown; keys: unknown; options: unknown }>);

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown, keys: unknown, options: unknown) => {
    cacheSpecs.push({ fn, keys, options });
    return fn;
  },
}));
vi.mock("@/lib/functions/media-repo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/functions/media-repo")>();
  return {
    ...actual,
    getAlbumStats: vi.fn(async () => ({
      total: 5,
      watched: 2,
      watching: 1,
      want: 2,
      trackTotal: 40,
    })),
  };
});

import { getAlbumStats } from "@/lib/functions/media-repo";
import { getCachedAlbumStats } from "@/lib/functions/cached-media";

describe("getCachedAlbumStats", () => {
  it("caches getAlbumStats for 24h under media and media:lists tags", async () => {
    expect(cacheSpecs).toContainEqual({
      fn: getAlbumStats,
      keys: ["public-album-stats-v1"],
      options: { revalidate: 86400, tags: ["media", "media:lists"] },
    });
    await expect(getCachedAlbumStats()).resolves.toEqual({
      total: 5,
      watched: 2,
      watching: 1,
      want: 2,
      trackTotal: 40,
    });
    expect(getAlbumStats).toHaveBeenCalledOnce();
  });
});
