import { beforeEach, expect, test, vi } from "vitest";

const state = vi.hoisted(/* 在模块模拟提升阶段创建共享查询记录和模拟结果容器。 */ () => ({
  executed: [] as Array<{ table: string; columns?: string; head?: boolean }>,
  results: {} as Record<string, { data: unknown; error: null | { code: string }; count?: number }>,
}));
vi.mock("@/utils/supabase", /* 提供可记录查询的 Supabase 模块替身。 */ () => ({
  getSupabasePublicServer: /* 返回带链式查询接口的公开服务端客户端替身。 */ () => ({
    /** 为指定表创建查询记录，并返回可等待的链式接口。 */
    from(table: string) {
      const request: { table: string; columns?: string; head?: boolean } = { table };
      const chain = {
        /** 记录所选字段及是否仅查询计数，并返回链对象继续调用。 */
        select(columns: string, options?: { head?: boolean }) { request.columns = columns; request.head = options?.head; return chain; },
        eq: /* 忽略等值筛选并返回同一模拟查询链。 */ () => chain, in: /* 忽略集合筛选并返回同一模拟查询链。 */ () => chain, order: /* 忽略排序参数并返回同一模拟查询链。 */ () => chain, range: /* 忽略分页范围并返回同一模拟查询链。 */ () => chain,
        /** 等待查询时保存请求记录，再把预设表结果交给后续 Promise 回调。 */
        then(resolve: (value: unknown) => unknown) {
          state.executed.push(request);
          return Promise.resolve(state.results[table] ?? { data: [], error: null, count: 0 }).then(resolve);
        },
      };
      return chain;
    },
  }),
}));
import { fetchMediaCardsServer, searchMediaServer, getSeasonsBySeriesId, MediaRepositoryError } from "@/lib/functions/media-repo";

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
  const rows = await getSeasonsBySeriesId("s");
  expect(rows[0]).toMatchObject({ title: "第 1 季", episodeCount: 0, releaseYearRange: undefined });
  expect(rows[1]).toMatchObject({ episodeCount: 12, watchedEpisodeCount: 8, releaseYearRange: "2026" });
  expect(state.executed).toHaveLength(1);
});

test("only missing views use the rollout fallback", /* 验证仅视图缺失会触发回退，权限类错误仍抛出。 */ async () => {
  state.results.v_media_season_summaries = { data: null, error: { code: "PGRST205" } };
  expect(await getSeasonsBySeriesId("s")).toEqual([]);
  expect(state.executed.map(/* 提取查询表名以确认执行了缺失视图回退。 */ (query) => query.table)).toEqual(["v_media_season_summaries", "tv_seasons"]);
  state.results.v_media_season_summaries = { data: null, error: { code: "42501" } };
  await expect(getSeasonsBySeriesId("s")).rejects.toBeInstanceOf(MediaRepositoryError);
});
