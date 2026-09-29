import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAiringShows, readLibraryCounts } from "@/lib/admin/overview";
import { searchMedia } from "@/app/(admin)/manage/search-actions";
import { requireOwner } from "@/lib/auth/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ requireOwner: vi.fn() }));

type Result = { data?: unknown; error?: unknown; count?: number };
type Query = { table: string; filters: Record<string, unknown>; calls: string[] };
/** 链式替身：记录每次查询的筛选条件，由处理函数按表名与条件返回结果。 */
function fakeDb(handle: (query: Query) => Result) {
  const queries: Query[] = [];
  const from = vi.fn((table: string) => {
    const query: Query = { table, filters: {}, calls: [] };
    queries.push(query);
    const run = () => ({ data: null, error: null, ...handle(query) });
    const builder: Record<string, unknown> = {
      maybeSingle: async () => run(),
      then: (resolve: (value: Result) => void) => resolve(run()),
    };
    for (const method of ["select", "order", "limit", "in", "or", "range"]) builder[method] = (...args: unknown[]) => { query.calls.push(`${method}:${JSON.stringify(args)}`); return builder; };
    for (const method of ["eq", "gte", "lte"]) builder[method] = (column: string, value: unknown) => { query.filters[`${method}:${column}`] = value; return builder; };
    return builder;
  });
  return { db: { from } as unknown as SupabaseClient, queries };
}

const today = "2026-09-29";

describe("待录入", () => {
  /** 三个节目：两个按间隔推算已到期，一个下周才播；到期的排在前面。 */
  const shows = [
    { id: "conan", title: "名侦探柯南", sort_date: "2026-09-26" },
    { id: "lotus", title: "白莲花度假村", sort_date: "2026-09-20" },
    { id: "severance", title: "人生切割术", sort_date: "2026-09-12" },
  ];
  const episodes: Record<string, { episode_number: number; media: { title: string; release_date: string; runtime: number } }[]> = {
    "season:conan": [{ episode_number: 1168, media: { title: "第 1,168 集", release_date: "2026-09-26", runtime: 24 } }, { episode_number: 1167, media: { title: "第 1,167 集", release_date: "2026-09-19", runtime: 24 } }],
    "season:lotus": [{ episode_number: 6, media: { title: "E6", release_date: "2026-09-20", runtime: 60 } }, { episode_number: 5, media: { title: "E5", release_date: "2026-09-13", runtime: 60 } }],
    "season:severance": [{ episode_number: 7, media: { title: "Chikhai Bardo", release_date: "2026-09-12", runtime: 52 } }, { episode_number: 6, media: { title: "Attila", release_date: "2026-09-05", runtime: 48 } }],
  };
  function handle(query: Query): Result {
    if (query.table === "v_manage_media_order") return { data: shows };
    if (query.table === "media_items") return { data: shows.map(show => ({ id: show.id, cover_url: null })) };
    if (query.table === "tv_seasons") return { data: { id: `season:${query.filters["eq:series_id"]}`, season_number: 2 } };
    if (query.table === "tv_episodes") return { data: episodes[query.filters["eq:season_id"] as string] };
    return {};
  }

  it("只看最近 30 天到今天为止播出的节目，推算已到期的排在前面并给出下一集编号", async () => {
    const { db, queries } = fakeDb(handle);
    const result = await readAiringShows(db, today);
    const recent = queries.find(query => query.table === "v_manage_media_order")!;
    expect(recent.filters).toMatchObject({ "eq:type": "tv_show", "gte:sort_date": "2026-08-30", "lte:sort_date": today });
    expect(result.map(show => [show.title, show.overdue, show.next.number, show.next.releaseDate])).toEqual([
      ["白莲花度假村", true, 7, "2026-09-27"],
      ["人生切割术", true, 8, "2026-09-19"],
      ["名侦探柯南", false, 1169, "2026-10-03"],
    ]);
    expect(result[1].lastEpisode).toEqual({ number: 7, title: "Chikhai Bardo" });
  });

  it("没有近期播出的节目时不再读取季集", async () => {
    const { db, queries } = fakeDb(query => (query.table === "v_manage_media_order" ? { data: [] } : {}));
    expect(await readAiringShows(db, today)).toEqual([]);
    expect(queries).toHaveLength(1);
  });

  it("片库统计任一失败即报错，不显示错误的零", async () => {
    const { db } = fakeDb(query => (query.table === "people" ? { error: { code: "500" } } : { count: 3 }));
    await expect(readLibraryCounts(db)).rejects.toThrow("无法读取片库统计");
  });
});

describe("全局搜索", () => {
  const rows = [
    { id: "e1", type: "tv_episode", title: "第 1,166 集", alternate_title: null, release_date: "2026-09-19", cover_url: null, season: null, episode: { episode_number: 1166, season: { season_number: 32, series: { title: "名侦探柯南" } } }, seasons: [{ count: 0 }] },
    { id: "m1", type: "movie", title: "名侦探柯南：百万美元的五棱星", alternate_title: "Detective Conan: The Million-dollar Pentagram", release_date: "2024-04-12", cover_url: null, season: null, episode: null, seasons: [{ count: 0 }] },
    { id: "s1", type: "tv_season", title: "第 32 季", alternate_title: null, release_date: null, cover_url: null, season: { season_number: 32, parent: { title: "名侦探柯南" } }, episode: null, seasons: [{ count: 0 }] },
    { id: "t1", type: "tv_show", title: "名侦探柯南", alternate_title: "Detective Conan", release_date: null, cover_url: null, season: null, episode: null, seasons: [{ count: 32 }] },
  ];
  let queries: Query[];
  beforeEach(() => {
    const fake = fakeDb(() => ({ data: rows }));
    queries = fake.queries;
    vi.mocked(requireOwner).mockResolvedValue({ db: fake.db, user: {} } as unknown as Awaited<ReturnType<typeof requireOwner>>);
  });

  it("同时搜标题与副标题；完全同名的排最前，其次按节目、电影、季、单集，并附上所属节目", async () => {
    const { hits } = await searchMedia(" 名侦探柯南 ");
    expect(queries[0].calls.some(call => call.startsWith("or:") && call.includes("alternate_title.ilike"))).toBe(true);
    expect(hits.map(hit => [hit.type, hit.context])).toEqual([
      ["tv_show", "Detective Conan · 32 季"],
      ["movie", "Detective Conan: The Million-dollar Pentagram · 2024-04-12"],
      ["tv_season", "名侦探柯南 · 第 32 季"],
      ["tv_episode", "名侦探柯南 · 第 32 季 · 第 1,166 集 · 2026-09-19"],
    ]);
  });

  it("空白输入不查询数据库", async () => {
    expect(await searchMedia("   ")).toEqual({ hits: [] });
    expect(queries).toHaveLength(0);
  });

  it("先检查站长身份", async () => {
    vi.mocked(requireOwner).mockRejectedValue(new Error("unauthorized"));
    await expect(searchMedia("柯南")).rejects.toThrow("unauthorized");
  });
});
