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
    getBookStats: vi.fn(async () => ({
      total: 4,
      inProgress: 1,
      watched: 2,
      wantToWatch: 1,
    })),
  };
});

import { getBookStats } from "@/lib/functions/media-repo";
import { getCachedBookStats } from "@/lib/functions/cached-media";

describe("getCachedBookStats", () => {
  it("caches getBookStats for 24h under media and media:lists tags", async () => {
    expect(cacheSpecs).toContainEqual({
      fn: getBookStats,
      keys: ["public-book-stats-v1"],
      options: { revalidate: 86400, tags: ["media", "media:lists"] },
    });
    await expect(getCachedBookStats()).resolves.toEqual({
      total: 4,
      inProgress: 1,
      watched: 2,
      wantToWatch: 1,
    });
    expect(getBookStats).toHaveBeenCalledOnce();
  });
});
