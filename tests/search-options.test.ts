import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; select?: string; orders: unknown[][]; neq: unknown[][] }>,
  results: {} as Record<string, { data: unknown; error: unknown }>,
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}));

vi.mock("@/lib/supabase/public-server", () => ({
  getSupabasePublicServer: () => ({
    from(table: string) {
      const request = { table, select: undefined as string | undefined, orders: [] as unknown[][], neq: [] as unknown[][] };
      const chain = {
        select(columns: string) {
          request.select = columns;
          return chain;
        },
        order(...args: unknown[]) {
          request.orders.push(args);
          return chain;
        },
        neq(...args: unknown[]) {
          request.neq.push(args);
          return chain;
        },
        then(resolve: (value: unknown) => unknown) {
          state.calls.push(request);
          return Promise.resolve(state.results[table] ?? { data: [], error: null }).then(resolve);
        },
      };
      return chain;
    },
  }),
}));

import { fetchSearchOptionsServer, hasOnlyKnownTagFilters } from "@/lib/functions/search-options";

const options = { genres: ["剧情", "喜剧"], regions: ["日本"], languages: ["日语"], years: ["2024"] };

describe("筛选值必须是已知选项", () => {
  it("空筛选通过，逗号分隔的每一项都要在选项里", () => {
    expect(hasOnlyKnownTagFilters({}, options)).toBe(true);
    expect(hasOnlyKnownTagFilters({ genre: "剧情,喜剧", region: "日本", language: "日语" }, options)).toBe(true);
    expect(hasOnlyKnownTagFilters({ genre: "剧情,id.neq.0" }, options)).toBe(false);
    expect(hasOnlyKnownTagFilters({ region: "日本,韩国" }, options)).toBe(false);
    expect(hasOnlyKnownTagFilters({ language: " " }, options)).toBe(false);
  });
});

describe("搜索选项查询", () => {
  beforeEach(() => {
    state.calls = [];
    state.results = {};
  });

  it("并行读取类型、地区、语言和年份，并排除 All Time", async () => {
    state.results = {
      genres: { data: [{ name: "剧情" }, { name: "喜剧" }], error: null },
      regions: { data: [{ name: "日本" }], error: null },
      languages: { data: [{ name: "日语" }], error: null },
      release_year_stats: { data: [{ release_year: 2024 }, { release_year: "2020" }], error: null },
    };
    expect(await fetchSearchOptionsServer()).toEqual({
      genres: ["剧情", "喜剧"],
      regions: ["日本"],
      languages: ["日语"],
      years: ["2024", "2020"],
    });
    expect(state.calls.map((call) => call.table)).toEqual(["genres", "regions", "languages", "release_year_stats"]);
    expect(state.calls.every((call) => call.select === "name" || call.select === "release_year")).toBe(true);
    const years = state.calls[3];
    expect(years.neq).toEqual([["release_year", "All Time"]]);
    expect(years.orders).toEqual([["release_year", { ascending: false }]]);
    expect(state.calls[0].orders).toEqual([["name", { ascending: true }]]);
  });

  it("任一查询失败就抛出该错误，不返回残缺选项", async () => {
    const error = { code: "42501", message: "permission denied" };
    state.results = {
      genres: { data: [{ name: "剧情" }], error: null },
      regions: { data: null, error },
      languages: { data: [], error: null },
      release_year_stats: { data: [], error: null },
    };
    await expect(fetchSearchOptionsServer()).rejects.toBe(error);
    expect(state.calls).toHaveLength(4);
  });
});
