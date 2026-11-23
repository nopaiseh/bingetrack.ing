import { beforeEach, describe, expect, it, vi } from "vitest";

type Query = { table: string; calls: Array<{ method: string; args: unknown[] }> };
type Result = { data?: unknown; error?: unknown };

const state = vi.hoisted(() => {
  type RowQuery = { table: string; calls: Array<{ method: string; args: unknown[] }> };
  type RowResult = { data?: unknown; error?: unknown };
  return {
    queries: [] as RowQuery[],
    handle: (() => ({ data: [], error: null })) as (query: RowQuery) => RowResult,
  };
});

vi.mock("@/lib/supabase/public-server", () => ({
  getSupabasePublicServer: () => ({
    from(table: string) {
      const query: Query = { table, calls: [] };
      state.queries.push(query);
      const builder: Record<string, unknown> = {};
      const chain =
        (method: string) =>
        (...args: unknown[]) => {
          query.calls.push({ method, args });
          return builder;
        };
      for (const method of ["select", "eq", "neq", "in", "order", "limit", "gte", "lte"]) {
        builder[method] = chain(method);
      }
      const finish = () => ({ data: [], error: null, ...state.handle(query) });
      builder.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(finish()).then(resolve, reject);
      return builder;
    },
    rpc(fn: string, args: unknown) {
      const query: Query = { table: `rpc:${fn}`, calls: [{ method: "rpc", args: [args] }] };
      state.queries.push(query);
      return Promise.resolve({ data: [], error: null, ...state.handle(query) });
    },
  }),
}));

import { fetchTopMediaServer, MediaRepositoryError } from "@/lib/functions/media-repo";

const movieId = "11111111-1111-4111-8111-111111111111";
const showId = "22222222-2222-4222-8222-222222222222";

function args(query: Query, method: string) {
  return query.calls.find((call) => call.method === method)?.args;
}

function cardRow(
  id: string,
  type: "movie" | "tv_show" | "album" | "book",
  title: string,
  rating: number | null,
  extras: { artists?: string[] | null; authors?: string[] | null } = {},
) {
  return {
    id,
    type,
    title,
    sort_date: "2024-01-01",
    release_year: "2024",
    rating,
    genres: ["剧情"],
    languages: ["英语"],
    cover_url: "",
    status: "watched",
    summary: `${title} 简介`,
    artists: extras.artists ?? null,
    authors: extras.authors ?? null,
  };
}

describe("热门榜查询 fetchTopMediaServer", () => {
  beforeEach(() => {
    state.queries = [];
    state.handle = () => ({ data: [], error: null });
  });

  it("电影按评分降序、同分按 ID，并固定条数", async () => {
    state.handle = (query) => {
      if (query.table === "v_all_media") {
        return {
          data: [
            cardRow(movieId, "movie", "甲", 9),
            cardRow("33333333-3333-4333-8333-333333333333", "movie", "乙", 8.5),
          ],
        };
      }
      return { data: [] };
    };

    const items = await fetchTopMediaServer("movie", "2024", 10);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: movieId, title: "甲", type: "movies", rating: 9, summary: "甲 简介" });
    expect(items[0]).not.toHaveProperty("casts");

    const query = state.queries[0];
    expect(query.table).toBe("v_all_media");
    expect(String(args(query, "select")?.[0])).toContain("authors");
    expect(args(query, "eq")).toEqual(["type", "movie"]);
    expect(args(query, "limit")).toEqual([10]);
    expect(args(query, "gte")).toEqual(["sort_date", "2024-01-01"]);
    expect(args(query, "lte")).toEqual(["sort_date", "2024-12-31"]);
    expect(query.calls.filter((call) => call.method === "order").map((call) => call.args)).toEqual([
      ["rating", { ascending: false, nullsFirst: false }],
      ["id", { ascending: true }],
    ]);
  });

  it("无年份电影榜不筛日期；空结果返回 []", async () => {
    state.handle = () => ({ data: [] });
    expect(await fetchTopMediaServer("movie", null, 5)).toEqual([]);
    expect(state.queries[0].calls.some((call) => call.method === "gte")).toBe(false);
    expect(args(state.queries[0], "limit")).toEqual([5]);
  });

  it("视图查询失败抛出 MediaRepositoryError", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const cause = { message: "view down" };
      state.handle = () => ({ data: null, error: cause });
      await expect(fetchTopMediaServer("movie")).rejects.toMatchObject({
        name: "MediaRepositoryError",
        message: "Media repository operation failed: fetch top media",
        cause,
      });
      await expect(fetchTopMediaServer("movie")).rejects.toBeInstanceOf(MediaRepositoryError);
    } finally {
      log.mockRestore();
    }
  });

  it("年度电视节目先 RPC 排名再补卡片；排名为空返回 []", async () => {
    state.handle = (query) => {
      if (query.table === "rpc:get_top_tv_shows_by_year") {
        return { data: [{ series_id: showId, year_rating: "8.7" }] };
      }
      if (query.table === "v_all_media") {
        return { data: [cardRow(showId, "tv_show", "人生切割术", 9.1)] };
      }
      if (query.table === "v_media_series_years") {
        return { data: [{ series_id: showId, first_year: 2022, last_year: 2025 }] };
      }
      return { data: [] };
    };

    const items = await fetchTopMediaServer("tv_show", "2024", 3);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: showId,
      type: "shows",
      title: "人生切割术",
      rating: 8.7,
      release_year: "2022 - 2025",
    });
    expect(state.queries[0].table).toBe("rpc:get_top_tv_shows_by_year");
    expect(args(state.queries[0], "rpc")).toEqual([{ p_year: 2024, p_limit: 3 }]);

    state.queries = [];
    state.handle = (query) => (query.table === "rpc:get_top_tv_shows_by_year" ? { data: [] } : { data: [] });
    expect(await fetchTopMediaServer("tv_show", "2024", 3)).toEqual([]);
    expect(state.queries.map((query) => query.table)).toEqual(["rpc:get_top_tv_shows_by_year"]);
  });

  it("年度电视节目 RPC 或卡片查询失败向上抛出", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      state.handle = (query) =>
        query.table === "rpc:get_top_tv_shows_by_year" ? { data: null, error: { message: "rpc down" } } : { data: [] };
      await expect(fetchTopMediaServer("tv_show", "2024")).rejects.toMatchObject({
        message: "Media repository operation failed: rank year-specific TV series",
      });

      state.handle = (query) => {
        if (query.table === "rpc:get_top_tv_shows_by_year") {
          return { data: [{ series_id: showId, year_rating: 9 }] };
        }
        if (query.table === "v_all_media") return { data: null, error: { message: "cards down" } };
        return { data: [] };
      };
      await expect(fetchTopMediaServer("tv_show", "2024")).rejects.toMatchObject({
        message: "Media repository operation failed: fetch year-specific TV series",
      });
    } finally {
      log.mockRestore();
    }
  });

  it.each([
    {
      mediaType: "album" as const,
      publicType: "albums",
      id: "44444444-4444-4444-8444-444444444444",
      title: "叶惠美",
      extras: { artists: ["周杰伦"], authors: null },
      expectArtists: ["周杰伦"],
      expectAuthors: [],
    },
    {
      mediaType: "book" as const,
      publicType: "books",
      id: "55555555-5555-4555-8555-555555555555",
      title: "三体",
      extras: { artists: null, authors: ["刘慈欣"] },
      expectArtists: [],
      expectAuthors: ["刘慈欣"],
    },
  ])("精选 $mediaType 按评分与 sort_date 规则查询，不含单曲", async (fixture) => {
    state.handle = (query) => {
      if (query.table === "v_all_media") {
        return {
          data: [cardRow(fixture.id, fixture.mediaType, fixture.title, 9.1, fixture.extras)],
        };
      }
      return { data: [] };
    };

    const items = await fetchTopMediaServer(fixture.mediaType, "2024", 10);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: fixture.id,
      title: fixture.title,
      type: fixture.publicType,
      rating: 9.1,
      artists: fixture.expectArtists,
      authors: fixture.expectAuthors,
      summary: `${fixture.title} 简介`,
    });

    const query = state.queries[0];
    expect(query.table).toBe("v_all_media");
    expect(String(args(query, "select")?.[0])).toContain("authors");
    expect(args(query, "eq")).toEqual(["type", fixture.mediaType]);
    expect(args(query, "limit")).toEqual([10]);
    expect(args(query, "gte")).toEqual(["sort_date", "2024-01-01"]);
    expect(args(query, "lte")).toEqual(["sort_date", "2024-12-31"]);
    expect(query.calls.filter((call) => call.method === "order").map((call) => call.args)).toEqual([
      ["rating", { ascending: false, nullsFirst: false }],
      ["id", { ascending: true }],
    ]);
    // 只按 album／book 过滤，不会查 type=music。
    expect(query.calls.some((call) => call.method === "eq" && call.args[1] === "music")).toBe(false);
  });
});
