import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  calls: [] as Array<{
    table: string;
    select: string;
    eqs: Array<[string, unknown]>;
    ins: Array<[string, unknown[]]>;
    ranges: Array<[number, number]>;
  }>,
  results: [] as Array<{ data: unknown; error: unknown } | ((call: { table: string; ranges: Array<[number, number]> }) => { data: unknown; error: unknown })>,
}));

vi.mock("@/lib/supabase/public-server", () => ({
  getSupabasePublicServer: () => ({
    from(table: string) {
      const call = {
        table,
        select: "",
        eqs: [] as Array<[string, unknown]>,
        ins: [] as Array<[string, unknown[]]>,
        ranges: [] as Array<[number, number]>,
      };
      const chain = {
        select(columns: string) { call.select = columns; return chain; },
        eq(column: string, value: unknown) { call.eqs.push([column, value]); return chain; },
        in(column: string, value: unknown[]) { call.ins.push([column, value]); return chain; },
        order() { return chain; },
        range(start: number, end: number) { call.ranges.push([start, end]); return chain; },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          state.calls.push(call);
          const next = state.results.shift();
          const result = typeof next === "function" ? next(call) : next ?? { data: [], error: null };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return chain;
    },
  }),
}));

import { assembleContinueWatching, getContinueWatching, type ContinueWatchingShow } from "@/lib/continue-watching";

const showId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const seasonOne = "33333333-3333-4333-8333-333333333333";
const seasonTwo = "44444444-4444-4444-8444-444444444444";

function show(overrides: Partial<ContinueWatchingShow> & Pick<ContinueWatchingShow, "showId">): ContinueWatchingShow {
  return {
    title: "节目",
    coverUrl: "https://image.tmdb.org/t/p/original/poster.jpg",
    episodes: [],
    ...overrides,
  };
}

function episode(overrides: Partial<ContinueWatchingShow["episodes"][number]> & Pick<ContinueWatchingShow["episodes"][number], "seasonNumber" | "episodeNumber">) {
  return {
    showId,
    seasonId: overrides.seasonNumber === 2 ? seasonTwo : seasonOne,
    title: `第 ${overrides.episodeNumber} 集`,
    releaseDate: "2024-01-01",
    status: null as string | null,
    ...overrides,
  };
}

beforeEach(() => {
  state.calls = [];
  state.results = [];
});

describe("assembleContinueWatching", () => {
  it("returns an empty list when nothing is in progress", () => {
    expect(assembleContinueWatching([])).toEqual([]);
    expect(assembleContinueWatching([
      show({
        showId,
        episodes: [episode({ seasonNumber: 1, episodeNumber: 1, status: "want_to_watch" })],
      }),
    ])).toEqual([]);
  });

  it("skips earlier gaps and continues into the next season", () => {
    const [item] = assembleContinueWatching([
      show({
        showId,
        title: "  在看  ",
        coverUrl: "https://image.tmdb.org/t/p/w500/abc.jpg?region=us",
        episodes: [
          episode({ seasonNumber: 1, episodeNumber: 1, status: "watched", releaseDate: "2020-01-01" }),
          episode({ seasonNumber: 1, episodeNumber: 2, status: null, releaseDate: "2020-01-08" }),
          episode({ seasonNumber: 1, episodeNumber: 3, status: "watched", releaseDate: "2020-01-15", title: "  " }),
          episode({ seasonNumber: 2, episodeNumber: 1, status: null, releaseDate: "2021-05-01", title: "回归" }),
          episode({ seasonNumber: 2, episodeNumber: 2, status: "want_to_watch", releaseDate: "2021-05-08" }),
        ],
      }),
    ]);

    expect(item).toEqual({
      showId,
      title: "在看",
      posterPath: "/abc.jpg",
      href: `/shows/${showId}`,
      nextEpisode: {
        seasonNumber: 2,
        episodeNumber: 1,
        title: "回归",
        href: `/shows/${showId}/seasons/${seasonTwo}`,
      },
      seasonProgress: { seasonNumber: 2, watched: 0, total: 2 },
      lastWatchedAt: "2020-01-15T00:00:00.000Z",
    });
  });

  it("uses the last watched season once the series has no further episode", () => {
    const [item] = assembleContinueWatching([
      show({
        showId,
        coverUrl: "/already/poster.jpg",
        episodes: [
          episode({ seasonNumber: 1, episodeNumber: 1, status: "watched" }),
          episode({ seasonNumber: 1, episodeNumber: 2, status: "watched", releaseDate: null }),
        ],
      }),
    ]);

    expect(item.nextEpisode).toBeNull();
    expect(item.seasonProgress).toEqual({ seasonNumber: 1, watched: 2, total: 2 });
    expect(item.posterPath).toBe("/already/poster.jpg");
    expect(item.lastWatchedAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("falls back when the frontier episode has no release date", () => {
    const [missingFrontier] = assembleContinueWatching([
      show({
        showId,
        coverUrl: "https://images.example.com/poster.jpg",
        episodes: [
          episode({ seasonNumber: 1, episodeNumber: 1, status: "watched", releaseDate: "2022-03-01" }),
          episode({ seasonNumber: 1, episodeNumber: 2, status: "watched", releaseDate: null }),
        ],
      }),
    ]);
    const [missingAll] = assembleContinueWatching([
      show({
        showId: otherId,
        episodes: [episode({ showId: otherId, seasonNumber: 1, episodeNumber: 1, status: "watched", releaseDate: null })],
      }),
    ]);

    expect(missingFrontier.posterPath).toBeNull();
    expect(missingFrontier.lastWatchedAt).toBe("2022-03-01T00:00:00.000Z");
    expect(missingAll.lastWatchedAt).toBe("1970-01-01T00:00:00.000Z");
  });

  it("keeps the eight most recently progressed shows and breaks ties by id", () => {
    const shows = Array.from({ length: 9 }, (_, index) => {
      const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
      const day = index >= 7 ? "20" : String(index + 1).padStart(2, "0");
      return show({
        showId: id,
        episodes: [episode({
          showId: id,
          seasonNumber: 1,
          episodeNumber: 1,
          status: "watched",
          releaseDate: `2024-06-${day}`,
        })],
      });
    });

    const items = assembleContinueWatching(shows);
    expect(items).toHaveLength(8);
    expect(items.map((item) => item.showId)).toEqual([
      "00000000-0000-4000-8000-000000000007",
      "00000000-0000-4000-8000-000000000008",
      "00000000-0000-4000-8000-000000000006",
      "00000000-0000-4000-8000-000000000005",
      "00000000-0000-4000-8000-000000000004",
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000001",
    ]);
    expect(items[0].nextEpisode).toBeNull();
  });
});

describe("getContinueWatching", () => {
  it("returns an empty list without reading episodes when nothing is watching", async () => {
    state.results = [{ data: [], error: null }];
    await expect(getContinueWatching()).resolves.toEqual([]);
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0].table).toBe("v_all_media");
    expect(state.calls[0].eqs).toEqual([["type", "tv_show"], ["status", "watching"]]);
    expect(state.calls[0].select).toBe("id,title,cover_url");
    expect(state.calls[0].ranges).toEqual([[0, 999]]);
  });

  it("batches episode progress and applies the next-episode rule", async () => {
    state.results = [
      {
        data: [{
          id: showId,
          title: "信号",
          cover_url: "https://image.tmdb.org/t/p/original/signal.jpg",
        }],
        error: null,
      },
      {
        data: [
          {
            episode_number: "1",
            season: { id: seasonOne, series_id: showId, season_number: "1" },
            media: { title: "第一集", release_date: "2024-02-01", tracking: { status: "watched" } },
          },
          {
            episode_number: 2,
            season: [{ id: seasonOne, series_id: showId, season_number: 1 }],
            media: [{ title: null, release_date: "2024-02-08", tracking: [{ status: null }] }],
          },
          {
            episode_number: 3,
            season: { id: seasonOne, series_id: showId, season_number: 1 },
            media: { title: "第三集", release_date: "2024-02-15", tracking: [{ status: "want_to_watch" }] },
          },
        ],
        error: null,
      },
    ];

    await expect(getContinueWatching()).resolves.toEqual([{
      showId,
      title: "信号",
      posterPath: "/signal.jpg",
      href: `/shows/${showId}`,
      nextEpisode: {
        seasonNumber: 1,
        episodeNumber: 2,
        title: null,
        href: `/shows/${showId}/seasons/${seasonOne}`,
      },
      seasonProgress: { seasonNumber: 1, watched: 1, total: 3 },
      lastWatchedAt: "2024-02-01T00:00:00.000Z",
    }]);
    expect(state.calls[1].table).toBe("tv_episodes");
    expect(state.calls[1].ins).toEqual([["season.series_id", [showId]]]);
    expect(state.calls[1].select).not.toMatch(/\*/);
  });

  it("keeps the original database error when the show query fails", async () => {
    const error = { code: "42501", message: "permission denied" };
    state.results = [{ data: null, error }];
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(getContinueWatching()).rejects.toMatchObject({ name: "MediaRepositoryError", cause: error });
    } finally {
      log.mockRestore();
    }
    expect(state.calls).toHaveLength(1);
  });

  it("splits episode reads into chunks of show ids", async () => {
    const shows = Array.from({ length: 101 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      title: "节目",
      cover_url: null,
    }));
    state.results = [
      { data: shows, error: null },
      { data: [], error: null },
      { data: [], error: null },
    ];

    await expect(getContinueWatching()).resolves.toEqual([]);
    const episodeCalls = state.calls.filter((call) => call.table === "tv_episodes");
    expect(episodeCalls.map((call) => call.ins[0][1].length)).toEqual([100, 1]);
  });
});
