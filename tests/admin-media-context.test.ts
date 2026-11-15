import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mediaChoiceFields } from "@/lib/admin/catalog";
import { readImpact, readParent, readSiblings } from "@/lib/admin/media-context";

const show = "11111111-1111-4111-8111-111111111111";
const season1 = "22222222-2222-4222-8222-222222222222";
const season2 = "33333333-3333-4333-8333-333333333333";
const episode2 = "55555555-5555-4555-8555-555555555555";
const episode9 = "66666666-6666-4666-8666-666666666666";

type Result = { data?: unknown; error?: unknown; count?: number | null };
type QueryCall = { method: string; args: unknown[] };
type Query = { table: string; calls: QueryCall[] };

function callArgs(query: Query, method: string) {
  return query.calls.find((call) => call.method === method)?.args;
}

/** 记录链式调用。maybeSingle 与直接 await 都按已经记录的条件返回。 */
function fakeDb(handle: (query: Query) => Result) {
  const queries: Query[] = [];
  const from = vi.fn((table: string) => {
    const query: Query = { table, calls: [] };
    queries.push(query);
    const builder: Record<string, unknown> = {};
    const chain = (method: string) => (...args: unknown[]) => {
      query.calls.push({ method, args });
      return builder;
    };
    for (const method of ["select", "eq", "gt", "lt", "order", "limit"]) builder[method] = chain(method);
    const finish = () => ({ data: null, error: null, count: null, ...handle(query) });
    builder.maybeSingle = () => Promise.resolve(finish());
    builder.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(finish()).then(resolve, reject);
    return builder;
  });
  return { db: { from } as unknown as SupabaseClient, queries, from };
}

describe("上级资料", () => {
  it("空 ID 不查询，缺失行返回空", async () => {
    const { db, from, queries } = fakeDb(() => ({ data: null }));
    expect(await readParent(db, "")).toBeUndefined();
    expect(from).not.toHaveBeenCalled();
    expect(await readParent(db, show)).toBeUndefined();
    expect(queries).toHaveLength(1);
    expect(callArgs(queries[0], "eq")).toEqual(["id", show]);
  });

  it("用选项字段读出标题、类型和季说明", async () => {
    const { db, queries } = fakeDb(() => ({
      data: {
        id: season2,
        title: "第二季",
        type: "tv_season",
        cover_url: "https://image.tmdb.org/s.jpg",
        season: { season_number: 2, parent: { title: "人生切割术" } },
      },
    }));
    expect(await readParent(db, season2)).toEqual({
      id: season2,
      name: "第二季",
      detail: "人生切割术 · 第 2 季",
      cover_url: "https://image.tmdb.org/s.jpg",
      type: "tv_season",
    });
    expect(callArgs(queries[0], "select")).toEqual([mediaChoiceFields]);
    expect(callArgs(queries[0], "eq")).toEqual(["id", season2]);
  });

  it("查询失败时不把数据库错误原文抛给页面", async () => {
    const { db } = fakeDb(() => ({ data: null, error: { message: "permission denied" } }));
    await expect(readParent(db, show)).rejects.toThrow("无法读取上级资料。");
  });
});

describe("删除范围", () => {
  it("电影和单集没有下属季集，不发计数查询", async () => {
    const { db, from } = fakeDb(() => ({ count: 9 }));
    expect(await readImpact(db, show, "movie")).toEqual({ seasons: 0, episodes: 0 });
    expect(await readImpact(db, show, "tv_episode")).toEqual({ seasons: 0, episodes: 0 });
    expect(from).not.toHaveBeenCalled();
  });

  it("电视节目按节目计数季和集，季只计本季单集", async () => {
    const showDb = fakeDb((query) => ({ count: query.table === "tv_seasons" ? 4 : 40 }));
    expect(await readImpact(showDb.db, show, "tv_show")).toEqual({ seasons: 4, episodes: 40 });
    expect(callArgs(showDb.queries[0], "select")).toEqual(["id", { count: "exact", head: true }]);
    expect(callArgs(showDb.queries[0], "eq")).toEqual(["series_id", show]);
    expect(callArgs(showDb.queries[1], "eq")).toEqual(["tv_seasons.series_id", show]);
    expect(String(callArgs(showDb.queries[1], "select")?.[0])).toContain("!inner");

    const seasonDb = fakeDb(() => ({ count: 9 }));
    expect(await readImpact(seasonDb.db, season2, "tv_season")).toEqual({ seasons: 0, episodes: 9 });
    expect(seasonDb.queries).toHaveLength(1);
    expect(seasonDb.queries[0].table).toBe("tv_episodes");
    expect(callArgs(seasonDb.queries[0], "eq")).toEqual(["season_id", season2]);
  });

  it("计数失败时拒绝，不用返回行数冒充总数", async () => {
    const { db } = fakeDb((query) => query.table === "tv_episodes" ? { count: null, error: { code: "42501" } } : { count: 1 });
    await expect(readImpact(db, show, "tv_show")).rejects.toThrow("无法核对下属内容数量，请重试。");
  });
});

describe("相邻条目", () => {
  it("不是季或单集、缺少上级或编号时不查询", async () => {
    const { db, from } = fakeDb(() => ({ data: null }));
    expect(await readSiblings(db, "movie", show, 1)).toEqual({});
    expect(await readSiblings(db, "tv_season", null, 1)).toEqual({});
    expect(await readSiblings(db, "tv_episode", season2, null)).toEqual({});
    expect(from).not.toHaveBeenCalled();
  });

  it("同一季内找到前后集时不再跨季", async () => {
    const { db, queries } = fakeDb((query) => {
      const earlier = query.calls.some((call) => call.method === "lt");
      return {
        data: {
          id: earlier ? episode9 : episode2,
          episode_number: earlier ? 1 : 2,
          media: { title: earlier ? "第一集" : "第二集" },
        },
      };
    });
    expect(await readSiblings(db, "tv_episode", season2, 1)).toEqual({
      previous: { id: episode9, title: "第一集", number: 1 },
      next: { id: episode2, title: "第二集", number: 2 },
    });
    expect(queries).toHaveLength(2);
    expect(queries.every((query) => query.table === "tv_episodes")).toBe(true);
  });

  it("本季没有更早的单集时，取上一季的最后一集", async () => {
    const { db, queries } = fakeDb((query) => {
      if (query.table === "tv_episodes") {
        const parent = callArgs(query, "eq")?.[1];
        const earlier = query.calls.some((call) => call.method === "lt");
        const later = query.calls.some((call) => call.method === "gt");
        if (parent === season2 && earlier) return { data: null };
        if (parent === season2 && later) return { data: { id: episode2, episode_number: 2, media: { title: "第二集" } } };
        if (parent === season1) return { data: { id: episode9, episode_number: 9, media: [{ title: "季终" }] } };
        return { data: null };
      }
      const selected = String(callArgs(query, "select")?.[0]);
      if (selected.startsWith("series_id")) return { data: { series_id: show, season_number: 2 } };
      if (query.calls.some((call) => call.method === "lt")) return { data: [{ id: season1, season_number: 1 }] };
      return { data: null };
    });

    expect(await readSiblings(db, "tv_episode", season2, 1)).toEqual({
      previous: { id: episode9, title: "季终", number: 9, season: 1 },
      next: { id: episode2, title: "第二集", number: 2 },
    });
    const crossSeason = queries.filter((query) => query.table === "tv_seasons" && query.calls.some((call) => call.method === "lt"));
    expect(crossSeason).toHaveLength(1);
    expect(callArgs(crossSeason[0], "eq")).toEqual(["series_id", show]);
  });

  it("当前季不存在时保留本季结果，不再跨季", async () => {
    const { db, queries } = fakeDb((query) => {
      if (query.table === "tv_episodes" && query.calls.some((call) => call.method === "gt")) {
        return { data: { id: episode2, episode_number: 2, media: { title: "第二集" } } };
      }
      return { data: null };
    });
    expect(await readSiblings(db, "tv_episode", season2, 1)).toEqual({
      previous: undefined,
      next: { id: episode2, title: "第二集", number: 2 },
    });
    expect(queries.some((query) => query.calls.some((call) => call.method === "lt" && call.args[0] === "season_number"))).toBe(false);
  });

  it("相邻查询失败时抛出页面文案", async () => {
    const { db } = fakeDb(() => ({ data: null, error: { code: "42501" } }));
    await expect(readSiblings(db, "tv_season", show, 2)).rejects.toThrow("无法读取相邻条目。");
  });
});
