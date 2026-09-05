import { beforeEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  executed: [] as Array<{ table: string; columns?: string; head?: boolean }>,
  results: {} as Record<string, { data: unknown; error: null | { code: string }; count?: number }>,
}));
vi.mock("@/utils/supabase", () => ({
  getSupabasePublicServer: () => ({
    from(table: string) {
      const request: { table: string; columns?: string; head?: boolean } = { table };
      const chain = {
        select(columns: string, options?: { head?: boolean }) { request.columns = columns; request.head = options?.head; return chain; },
        eq: () => chain, in: () => chain, order: () => chain, range: () => chain,
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

beforeEach(() => { state.executed = []; state.results = {}; });

test("catalog requests omit exact counts and detail columns", async () => {
  state.results.v_all_media = { data: [{ id: "m", type: "movie", title: "Movie" }], error: null, count: 50 };
  const rows = await fetchMediaCardsServer({ type: "movie", limit: 10 });
  expect(rows).toHaveLength(1);
  expect(state.executed).toHaveLength(1);
  expect(state.executed[0].head).not.toBe(true);
  expect(state.executed[0].columns).not.toMatch(/summary|casts|directors|runtime|\*/);
});

test("search retains exact pagination totals", async () => {
  state.results.v_all_media = { data: [{ id: "m", type: "movie" }], error: null, count: 50 };
  expect((await searchMediaServer()).total).toBe(50);
  expect(state.executed.filter((query) => query.head)).toHaveLength(1);
});

test("series card years use aggregates without transferring episodes", async () => {
  state.results.v_all_media = { data: [{ id: "s", type: "tv_series", release_year: "2020 - Present" }], error: null };
  state.results.v_media_series_years = { data: [{ series_id: "s", first_year: 2020, last_year: 2027 }], error: null };
  expect((await fetchMediaCardsServer())[0].release_year).toBe("2020 - 2027");
  expect(state.executed.map((query) => query.table)).toEqual(["v_all_media", "v_media_series_years"]);
});

test("season aggregates preserve empty seasons and single-year display", async () => {
  state.results.v_media_season_summaries = { data: [
    { id: "empty", season_number: 1, episode_count: 0, watched_episode_count: 0, first_year: null, last_year: null },
    { id: "full", season_number: 2, episode_count: 12, watched_episode_count: 8, first_year: 2026, last_year: 2026 },
  ], error: null };
  const rows = await getSeasonsBySeriesId("s");
  expect(rows[0]).toMatchObject({ title: "第 1 季", episodeCount: 0, releaseYearRange: undefined });
  expect(rows[1]).toMatchObject({ episodeCount: 12, watchedEpisodeCount: 8, releaseYearRange: "2026" });
  expect(state.executed).toHaveLength(1);
});

test("only missing views use the rollout fallback", async () => {
  state.results.v_media_season_summaries = { data: null, error: { code: "PGRST205" } };
  expect(await getSeasonsBySeriesId("s")).toEqual([]);
  expect(state.executed.map((query) => query.table)).toEqual(["v_media_season_summaries", "tv_seasons"]);
  state.results.v_media_season_summaries = { data: null, error: { code: "42501" } };
  await expect(getSeasonsBySeriesId("s")).rejects.toBeInstanceOf(MediaRepositoryError);
});
