import { describe, expect, it, vi } from "vitest";

const cacheSpecs = vi.hoisted(() => [] as Array<{ keys: unknown; options: unknown }>);

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown, keys: unknown, options: unknown) => {
    cacheSpecs.push({ keys, options });
    return fn;
  },
}));
vi.mock("@/lib/supabase/public-server", () => ({
  getSupabasePublicServer: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
          neq: () => ({
            order: () => ({
              then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
            }),
          }),
        }),
      }),
    }),
  }),
}));

await import("@/lib/functions/search-options");

describe("search-options 缓存", () => {
  it("筛选选项用 revalidate:false，靠 media / media:lists 标签失效", () => {
    expect(cacheSpecs).toContainEqual({
      keys: ["search-options-v2"],
      options: { revalidate: false, tags: ["media", "media:lists"] },
    });
  });
});
