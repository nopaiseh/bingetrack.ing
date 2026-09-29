import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readSeriesStructure, suggestNextEpisode, type StructureEpisode } from "@/lib/admin/series-structure";

vi.mock("server-only", () => ({}));

const show = "11111111-1111-4111-8111-111111111111";
const season1 = "22222222-2222-4222-8222-222222222222";
const season2 = "33333333-3333-4333-8333-333333333333";

function episode(number: number, releaseDate: string | null, runtime: number | null = 50): StructureEpisode {
  return { id: `e${number}`, number, title: `第 ${number} 集`, watched: false, releaseDate, runtime };
}

type Result = { data: unknown; error: unknown };
/** 最小链式替身：记录筛选与分页，按表名返回预设结果。 */
function fakeDb(handlers: Record<string, (query: { filters: Record<string, unknown>; range?: [number, number] }) => Result>) {
  const ranges: [string, number, number][] = [];
  const from = vi.fn((table: string) => {
    const query: { filters: Record<string, unknown>; range?: [number, number] } = { filters: {} };
    const run = () => (handlers[table] ?? (() => ({ data: [], error: null })))(query);
    const builder = {
      select: () => builder,
      order: () => builder,
      eq: (column: string, value: unknown) => { query.filters[column] = value; return builder; },
      range: (start: number, end: number) => { query.range = [start, end]; ranges.push([table, start, end]); return builder; },
      maybeSingle: async () => run(),
      then: (resolve: (value: Result) => void) => resolve(run()),
    };
    return builder;
  });
  return { db: { from } as unknown as SupabaseClient, ranges };
}

describe("suggestNextEpisode", () => {
  it("按最近的播出间隔推算日期，编号接续末集并沿用时长", () => {
    expect(suggestNextEpisode([episode(6, "2025-02-21", 48), episode(7, "2025-02-28", 52)])).toEqual({ number: 8, releaseDate: "2025-03-07", runtime: 52, afterTitle: "第 7 集", dateBasis: "interval" });
  });

  it("整批上线时越过同一天的多集，按上一批的间隔推算", () => {
    const batches = [episode(1, "2026-09-09"), episode(2, "2026-09-09"), episode(3, "2026-09-16"), episode(4, "2026-09-16")];
    expect(suggestNextEpisode(batches)).toMatchObject({ number: 5, releaseDate: "2026-09-23", dateBasis: "interval" });
  });

  it("最近几集都在同一天上线时不推算，并说明原因，不当成缺少日期", () => {
    expect(suggestNextEpisode([episode(8, "2026-09-23"), episode(9, "2026-09-23")])).toMatchObject({ number: 10, releaseDate: null, dateBasis: "same_day" });
  });

  it("只有一个日期时按每周推算，没有日期时不预填", () => {
    expect(suggestNextEpisode([episode(1, "2025-01-01")])).toMatchObject({ releaseDate: "2025-01-08", dateBasis: "single" });
    expect(suggestNextEpisode([episode(1, null), episode(2, null)])).toMatchObject({ releaseDate: null, dateBasis: "missing" });
  });

  it("末集日期较早或间隔超过一年时不推算", () => {
    expect(suggestNextEpisode([episode(1, "2025-03-01"), episode(2, "2025-01-01")])).toMatchObject({ releaseDate: null, dateBasis: "irregular" });
    expect(suggestNextEpisode([episode(1, "2020-01-01"), episode(2, "2025-01-01")])).toMatchObject({ releaseDate: null, dateBasis: "irregular" });
  });

  it("没有单集时从第 1 集开始", () => {
    expect(suggestNextEpisode([])).toEqual({ number: 1, releaseDate: null, runtime: null, afterTitle: null, dateBasis: "missing" });
  });
});

describe("readSeriesStructure", () => {
  const seasons = [
    { id: season1, season_number: 1, title: "第 1 季", episode_count: 9, watched_episode_count: 9 },
    { id: season2, season_number: 2, title: null, episode_count: 1005, watched_episode_count: 3 },
  ];
  /** 第 2 季超过单次读取上限，需分块读完。 */
  function episodes(query: { range?: [number, number] }): Result {
    const [start, end] = query.range ?? [0, 999];
    const rows = Array.from({ length: 1005 }, (_, index) => ({ id: `e${index + 1}`, episode_number: index + 1, media: { title: `第 ${index + 1} 集`, release_date: null, runtime: "24", tracking: index < 3 ? [{ status: "watched" }] : null } }));
    return { data: rows.slice(start, end + 1), error: null };
  }
  const handlers = {
    tv_seasons: () => ({ data: { series_id: show }, error: null }),
    media_items: () => ({ data: { id: show, title: "名侦探柯南", alternate_title: "Detective Conan", cover_url: null }, error: null }),
    v_all_media: () => ({ data: { status: "watching", rating: "8.7" }, error: null }),
    v_media_season_summaries: () => ({ data: seasons, error: null }),
    tv_episodes: episodes,
  };

  it("编辑单集时经所属季找到电视节目，展开所属季并分块读完全部单集", async () => {
    const { db, ranges } = fakeDb(handlers);
    const structure = await readSeriesStructure(db, { id: "e5", type: "tv_episode", parent_id: season2 });
    expect(structure?.show).toMatchObject({ id: show, title: "名侦探柯南", status: "watching", rating: 8.7 });
    expect(structure?.expandedSeasonId).toBe(season2);
    expect(structure?.episodes).toHaveLength(1005);
    expect(structure?.episodes.slice(0, 4).map(item => item.watched)).toEqual([true, true, true, false]);
    expect(ranges.filter(([table]) => table === "tv_episodes").map(([, start]) => start)).toEqual([0, 1000]);
    expect(structure?.seasons.map(item => [item.number, item.title, item.status])).toEqual([[1, "第 1 季", "watched"], [2, "第 2 季", "watching"]]);
    expect(structure?.totalEpisodes).toBe(1014);
    expect(structure?.nextSeasonNumber).toBe(3);
    expect(structure?.nextEpisode).toMatchObject({ number: 1006, runtime: 24 });
  });

  it("编辑电视节目时展开编号最大的季", async () => {
    const { db } = fakeDb(handlers);
    const structure = await readSeriesStructure(db, { id: show, type: "tv_show", parent_id: null });
    expect(structure?.expandedSeasonId).toBe(season2);
  });

  it("没有季的电视节目从第 1 季开始，不提供新增单集", async () => {
    const { db } = fakeDb({ ...handlers, v_media_season_summaries: () => ({ data: [], error: null }) });
    const structure = await readSeriesStructure(db, { id: show, type: "tv_show", parent_id: null });
    expect(structure).toMatchObject({ expandedSeasonId: null, episodes: [], nextSeasonNumber: 1, nextEpisode: null, totalEpisodes: 0 });
  });

  it("电影没有剧集结构", async () => {
    const { db } = fakeDb(handlers);
    expect(await readSeriesStructure(db, { id: show, type: "movie", parent_id: null })).toBeNull();
    expect(db.from).not.toHaveBeenCalled();
  });

  it("查询失败时报错，不把空结果当成真实结构", async () => {
    const { db } = fakeDb({ ...handlers, tv_episodes: () => ({ data: null, error: { code: "500" } }) });
    await expect(readSeriesStructure(db, { id: season2, type: "tv_season", parent_id: show })).rejects.toThrow("无法读取剧集结构");
  });
});
