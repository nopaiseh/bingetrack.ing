import { beforeEach, expect, test, vi } from "vitest";

const state = vi.hoisted(/* 在模块模拟提升阶段创建共享查询记录和模拟结果容器。 */ () => ({
  executed: [] as Array<{
    table: string;
    columns?: string;
    head?: boolean;
    orders?: Array<{ column: string; ascending?: boolean; nullsFirst?: boolean }>;
    gtes?: Array<{ column: string; value: unknown }>;
    ltes?: Array<{ column: string; value: unknown }>;
  }>,
  results: {} as Record<string, { data: unknown; error: null | { code: string }; count?: number }>,
}));
vi.mock("@/lib/supabase/public-server", /* 提供可记录查询的 Supabase 模块替身。 */ () => ({
  getSupabasePublicServer: /* 返回带链式查询接口的公开服务端客户端替身。 */ () => ({
    /** 为指定表创建查询记录，并返回可等待的链式接口。 */
    from(table: string) {
      const request: {
        table: string;
        columns?: string;
        head?: boolean;
        orders: Array<{ column: string; ascending?: boolean; nullsFirst?: boolean }>;
        gtes: Array<{ column: string; value: unknown }>;
        ltes: Array<{ column: string; value: unknown }>;
      } = { table, orders: [], gtes: [], ltes: [] };
      const chain = {
        /** 记录所选字段及是否仅查询计数，并返回链对象继续调用。 */
        select(columns: string, options?: { head?: boolean }) { request.columns = columns; request.head = options?.head; return chain; },
        eq: /* 忽略等值筛选并返回同一模拟查询链。 */ () => chain, in: /* 忽略集合筛选并返回同一模拟查询链。 */ () => chain,
        order: /* 记录排序参数并返回同一模拟查询链。 */ (column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => {
          request.orders.push({ column, ascending: opts?.ascending, nullsFirst: opts?.nullsFirst });
          return chain;
        },
        gte: /* 记录下限筛选并返回同一模拟查询链。 */ (column: string, value: unknown) => {
          request.gtes.push({ column, value });
          return chain;
        },
        lte: /* 记录上限筛选并返回同一模拟查询链。 */ (column: string, value: unknown) => {
          request.ltes.push({ column, value });
          return chain;
        },
        overlaps: () => chain, or: () => chain, range: /* 忽略分页范围并返回同一模拟查询链。 */ () => chain,
        /** 等待查询时保存请求记录，再把预设表结果交给后续 Promise 回调。 */
        then(resolve: (value: unknown) => unknown) {
          state.executed.push(request);
          const raw = state.results[table];
          const result = typeof raw === "function" ? (raw as () => unknown)() : raw;
          return Promise.resolve(result ?? { data: [], error: null, count: 0 }).then(resolve);
        },
      };
      return chain;
    },
    rpc(fn: string) {
      state.executed.push({ table: `rpc:${fn}` });
      return Promise.resolve(state.results[`rpc:${fn}`] ?? { data: [], error: null });
    },
  }),
}));
import { fetchMediaCardsServer, searchMediaServer, getSeasonsBySeriesId, fetchStatsServer, MediaRepositoryError } from "@/lib/functions/media-repo";

beforeEach(/* 在每个测试前清空执行记录和模拟表结果。 */ () => { state.executed = []; state.results = {}; });

test("catalog requests omit exact counts and detail columns", /* 验证目录卡片查询不请求精确总数，也不读取详情专用字段。 */ async () => {
  state.results.v_all_media = { data: [{ id: "m", type: "movie", title: "Movie" }], error: null, count: 50 };
  const rows = await fetchMediaCardsServer({ type: "movie", limit: 10 });
  expect(rows).toHaveLength(1);
  expect(state.executed).toHaveLength(1);
  expect(state.executed[0].head).not.toBe(true);
  expect(state.executed[0].columns).not.toMatch(/summary|casts|directors|runtime|\*/);
});

test("search retains exact pagination totals", /* 验证搜索仍执行计数请求，并保留精确分页总数。 */ async () => {
  state.results.v_all_media = { data: [{ id: "m", type: "movie" }], error: null, count: 50 };
  expect((await searchMediaServer()).total).toBe(50);
  expect(state.executed.filter(/* 选出仅请求计数头的查询记录。 */ (query) => query.head)).toHaveLength(1);
});

test("series card years use aggregates without transferring episodes", /* 验证电视剧卡片从聚合视图读取年份范围，不传输逐集数据。 */ async () => {
  state.results.v_all_media = { data: [{ id: "s", type: "tv_series", release_year: "2020 - Present" }], error: null };
  state.results.v_media_series_years = { data: [{ series_id: "s", first_year: 2020, last_year: 2027 }], error: null };
  expect((await fetchMediaCardsServer())[0].release_year).toBe("2020 - 2027");
  expect(state.executed.map(/* 提取查询表名以断言实际访问的数据源。 */ (query) => query.table)).toEqual(["v_all_media", "v_media_series_years"]);
});

test("season aggregates preserve empty seasons and single-year display", /* 验证季摘要保留空季，并将同年范围显示为单个年份。 */ async () => {
  state.results.v_media_season_summaries = { data: [
    { id: "empty", season_number: 1, episode_count: 0, watched_episode_count: 0, first_year: null, last_year: null },
    { id: "full", season_number: 2, episode_count: 12, watched_episode_count: 8, first_year: 2026, last_year: 2026 },
  ], error: null };
  const rows = await getSeasonsBySeriesId("12345678-1234-1234-1234-123456789abc");
  expect(rows[0]).toMatchObject({ title: "第 1 季", episodeCount: 0, releaseYearRange: undefined });
  expect(rows[1]).toMatchObject({ episodeCount: 12, watchedEpisodeCount: 8, releaseYearRange: "2026" });
  expect(state.executed).toHaveLength(1);
});

test("only missing views use the rollout fallback", /* 验证仅视图缺失会触发回退，权限类错误仍抛出。 */ async () => {
  state.results.v_media_season_summaries = { data: null, error: { code: "PGRST205" } };
  expect(await getSeasonsBySeriesId("12345678-1234-1234-1234-123456789abc")).toEqual([]);
  expect(state.executed.map(/* 提取查询表名以确认执行了缺失视图回退。 */ (query) => query.table)).toEqual(["v_media_season_summaries", "tv_seasons"]);
  state.results.v_media_season_summaries = { data: null, error: { code: "42501" } };
  await expect(getSeasonsBySeriesId("12345678-1234-1234-1234-123456789abc")).rejects.toBeInstanceOf(MediaRepositoryError);
});

test("fetchStatsServer converts string counts to numbers including upcoming", /* 验证统计函数正确转换各种计数为数字（包括 upcoming）。 */ async () => {
  state.results["rpc:get_media_stats"] = {
    data: [{ total: "10", watched: "5", watching: "2", want: "3", upcoming: "1" }],
    error: null,
  };
  const stats = await fetchStatsServer("tv_series");
  expect(stats).toEqual({
    total: 10,
    watched: 5,
    watching: 2,
    want: 3,
    upcoming: 1,
  });
  expect(state.executed.map(/* 提取查询表名以确认执行了 RPC。 */ (query) => query.table)).toEqual(["rpc:get_media_stats"]);
});

test("fetchMediaCardsServer retries on transient gateway timeout and succeeds on retry", async () => {
  let attempt = 0;
  // @ts-expect-error test dynamic mock function
  state.results.v_all_media = () => {
    attempt++;
    if (attempt === 1) {
      return { data: null, error: { message: "Gateway Timeout" }, count: 0 };
    }
    return { data: [{ id: "m-retry", type: "movie", title: "Recovered Movie" }], error: null, count: 1 };
  };

  const rows = await fetchMediaCardsServer({ type: "movie", limit: 10 });
  expect(rows).toHaveLength(1);
  expect(rows[0].title).toBe("Recovered Movie");
  expect(attempt).toBe(2);
});

test("fetchMediaCardsServer applies compound date sort with sort_date, first_air_date and id", async () => {
  state.results.v_all_media = { data: [{ id: "s1", type: "tv_series" }], error: null };
  await fetchMediaCardsServer({ type: "tv_series", sort: "date_desc", limit: 10 });
  const query = state.executed.find((req) => req.table === "v_all_media");
  expect(query?.orders).toEqual([
    { column: "sort_date", ascending: false, nullsFirst: false },
    { column: "first_air_date", ascending: false, nullsFirst: false },
    { column: "id", ascending: true, nullsFirst: undefined },
  ]);
});

test("fetchMediaCardsServer applies decoupled year interval filter on last_air_date and first_air_date", async () => {
  state.results.v_all_media = { data: [{ id: "s1", type: "tv_series" }], error: null };
  await fetchMediaCardsServer({ type: "tv_series", startYear: "2010", endYear: "2015", limit: 10 });
  const query = state.executed.find((req) => req.table === "v_all_media");
  expect(query?.gtes).toEqual([{ column: "last_air_date", value: "2010-01-01" }]);
  expect(query?.ltes).toEqual([{ column: "first_air_date", value: "2015-12-31" }]);
});

