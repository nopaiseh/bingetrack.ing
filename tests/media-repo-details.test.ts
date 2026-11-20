import { beforeEach, describe, expect, it, vi } from "vitest";

type Query = { table: string; calls: Array<{ method: string; args: unknown[] }> };
type Result = { data?: unknown; error?: unknown };

const state = vi.hoisted(() => {
  type RowQuery = { table: string; calls: Array<{ method: string; args: unknown[] }> };
  type RowResult = { data?: unknown; error?: unknown };
  return {
    builds: 0,
    queries: [] as RowQuery[],
    handle: (() => ({ data: null, error: null })) as (query: RowQuery) => RowResult,
  };
});

vi.mock("@/lib/supabase/public-server", () => ({
  getSupabasePublicServer: () => {
    state.builds += 1;
    return {
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
        for (const method of ["select", "eq", "neq", "in", "order"]) builder[method] = chain(method);
        const finish = () => ({ data: null, error: null, ...state.handle(query) });
        builder.maybeSingle = () => Promise.resolve(finish());
        builder.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(finish()).then(resolve, reject);
        return builder;
      },
      rpc(fn: string, args: unknown) {
        const query: Query = { table: `rpc:${fn}`, calls: [{ method: "rpc", args: [args] }] };
        state.queries.push(query);
        return Promise.resolve({ data: null, error: null, ...state.handle(query) });
      },
    };
  },
}));

vi.mock("@/lib/report-error", () => ({ reportHandledError: vi.fn() }));

import { reportHandledError } from "@/lib/report-error";
import { getMediaById, getRelatedBySeries, getSeasonEpisodes, MediaRepositoryError } from "@/lib/functions/media-repo";

const seriesId = "12345678-1234-4234-8234-123456789abc";
const seasonId = "22345678-1234-4234-8234-123456789abc";
const mediaId = "32345678-1234-4234-8234-123456789abc";
const otherId = "42345678-1234-4234-8234-123456789abc";

function args(query: Query, method: string) {
  return query.calls.find((call) => call.method === method)?.args;
}

describe("作品详情与相关作品", () => {
  beforeEach(() => {
    state.builds = 0;
    state.queries = [];
    state.handle = () => ({ data: null, error: null });
    vi.mocked(reportHandledError).mockClear();
  });

  it("系列成员查询失败时仍返回详情，名称按忽略大小写排序", async () => {
    state.handle = (query) => {
      if (query.table === "v_all_media") return { data: { id: mediaId, type: "movie", title: "影片" } };
      return {
        data: [
          { media_series: { name: "Beta" } },
          { media_series: [{ name: "alpha" }] },
          { media_series: { name: "" } },
          { media_series: null },
        ],
      };
    };
    const media = await getMediaById(mediaId);
    expect(media).toMatchObject({ id: mediaId, title: "影片", type: "movies", series: ["alpha", "Beta"] });
    expect(args(state.queries[1], "select")).toEqual(["position, media_series(name)"]);
    expect(args(state.queries[1], "order")).toEqual(["position", { ascending: true, nullsFirst: false }]);

    state.queries = [];
    state.handle = (query) =>
      query.table === "v_all_media"
        ? { data: { id: mediaId, type: "tv_show", title: "剧" } }
        : { data: null, error: { code: "42501" } };
    expect(await getMediaById(mediaId)).toMatchObject({ title: "剧", series: [] });
    expect(reportHandledError).toHaveBeenCalledTimes(1);
    expect(reportHandledError).toHaveBeenCalledWith(`Failed to fetch series memberships for media ${mediaId}:`, {
      code: "42501",
    });
  });

  it("视图没有这一行时不再读取系列成员", async () => {
    expect(await getMediaById(mediaId)).toBeNull();
    expect(state.queries.map((query) => query.table)).toEqual(["v_all_media"]);
    expect(await getRelatedBySeries("", mediaId)).toEqual([]);
    expect(state.builds).toBe(1);
  });

  it("相关作品只读卡片列，系列查询失败或没有其他条目时返回空列表", async () => {
    state.handle = (query) => {
      if (query.table === "media_item_series") {
        return { data: [{ media_item_id: otherId }, { media_item_id: mediaId }] };
      }
      return {
        data: [
          { id: mediaId, type: "movie", title: "先", sort_date: "2020-01-01" },
          { id: otherId, type: "tv_show", title: "后", rating: 8 },
        ],
      };
    };
    const cards = await getRelatedBySeries("系列", "current");
    expect(cards.map((card) => [card.id, card.type, card.title])).toEqual([
      [mediaId, "movies", "先"],
      [otherId, "shows", "后"],
    ]);
    const membership = state.queries[0];
    expect(args(membership, "eq")).toEqual(["media_series.name", "系列"]);
    expect(args(membership, "neq")).toEqual(["media_item_id", "current"]);
    const cardsQuery = state.queries[1];
    expect(args(cardsQuery, "select")).toEqual([
      "id,type,title,sort_date,first_air_date,last_air_date,release_year,rating,genres,languages,cover_url,status,artists",
    ]);
    expect(args(cardsQuery, "in")).toEqual(["id", [otherId, mediaId]]);
    expect(String(args(cardsQuery, "select")?.[0])).not.toMatch(/summary|casts|directors|runtime/);

    state.queries = [];
    state.handle = () => ({ data: [], error: null });
    expect(await getRelatedBySeries("系列", mediaId)).toEqual([]);
    expect(state.queries.map((query) => query.table)).toEqual(["media_item_series"]);

    state.queries = [];
    state.handle = () => ({ data: null, error: { message: "membership down" } });
    expect(await getRelatedBySeries("系列", mediaId)).toEqual([]);
    expect(reportHandledError).toHaveBeenCalledWith("Failed to fetch related media IDs for series 系列:", {
      message: "membership down",
    });
    expect(state.queries.map((query) => query.table)).toEqual(["media_item_series"]);
  });

  it("卡片查询失败时上报并返回空列表", async () => {
    state.handle = (query) =>
      query.table === "media_item_series"
        ? { data: [{ media_item_id: otherId }] }
        : { data: null, error: { message: "cards down" } };
    expect(await getRelatedBySeries("系列", mediaId)).toEqual([]);
    expect(reportHandledError).toHaveBeenCalledWith("Failed to fetch related media details for series 系列:", {
      message: "cards down",
    });
  });
});

describe("季详情与单集分页", () => {
  beforeEach(() => {
    state.builds = 0;
    state.queries = [];
    state.handle = () => ({ data: null, error: null });
    vi.mocked(reportHandledError).mockClear();
  });

  it("季简介只选页面用到的字段，单集剧照不进入结果", async () => {
    state.handle = (query) => {
      if (query.table === "rpc:get_season_episode_page") {
        return {
          data: {
            season_number: 2,
            episode_count: "12",
            watched_count: "3",
            total_runtime: "480",
            average_rating: "8.5",
            first_release_date: "2020-01-02",
            last_release_date: "2021-03-04",
            total: "12",
            episodes: [
              {
                id: "e1",
                episode_number: 1,
                title: null,
                alternate_title: null,
                summary: null,
                cover_url: "https://image.tmdb.org/e.jpg",
                release_date: null,
                runtime: 40,
                status: "watched",
                rating: "9.5",
              },
              {
                id: "e2",
                episode_number: 2,
                title: "回响",
                alternate_title: "Echo",
                summary: "文本",
                cover_url: "https://image.tmdb.org/e2.jpg",
                release_date: "2020-01-09",
                runtime: null,
                status: null,
                rating: null,
              },
            ],
          },
        };
      }
      return {
        data: { title: "第二季", alternate_title: "Two", summary: "简介", cover_url: "https://image.tmdb.org/s.jpg" },
      };
    };

    const page = await getSeasonEpisodes(seriesId, seasonId, 2, 20, "watched", "desc");
    const rpc = state.queries.find((query) => query.table === "rpc:get_season_episode_page");
    const season = state.queries.find((query) => query.table === "media_items");
    expect(rpc?.calls[0].args).toEqual([
      {
        p_series_id: seriesId,
        p_season_id: seasonId,
        p_status: "watched",
        p_order: "desc",
        p_limit: 20,
        p_offset: 20,
      },
    ]);
    expect(args(season!, "select")).toEqual(["title, alternate_title, summary, cover_url"]);
    expect(args(season!, "eq")).toEqual(["id", seasonId]);
    expect(page).toMatchObject({
      season: {
        id: seasonId,
        seasonNumber: 2,
        title: "第二季",
        alternateTitle: "Two",
        coverUrl: "https://image.tmdb.org/s.jpg",
        episodeCount: 12,
        watchedEpisodeCount: 3,
        releaseYearRange: "2020 - 2021",
        summary: "简介",
      },
      total: 12,
      watchedCount: 3,
      totalRuntime: 480,
      averageRating: 8.5,
    });
    expect(page?.episodes[0]).toEqual({
      id: "e1",
      episodeNumber: 1,
      title: "第 1 集",
      alternateTitle: null,
      summary: "",
      releaseDate: null,
      runtime: 40,
      status: "watched",
      rating: 9.5,
    });
    expect(page?.episodes[0]).not.toHaveProperty("coverUrl");
    expect(page?.episodes[1]).toMatchObject({ title: "回响", alternateTitle: "Echo", summary: "文本", rating: null });
  });

  it("非法 ID 或空分页不访问数据库，简介失败保留原始原因", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await getSeasonEpisodes("bad", seasonId, 1, 20)).toBeNull();
      expect(await getSeasonEpisodes(seriesId, "bad", 1, 20)).toBeNull();
      expect(state.builds).toBe(0);

      state.handle = (query) =>
        query.table === "rpc:get_season_episode_page"
          ? { data: null, error: null }
          : { data: { title: "季" }, error: null };
      expect(await getSeasonEpisodes(seriesId, seasonId, 1, 20)).toBeNull();

      const cause = { code: "42501", message: "permission denied" };
      state.handle = (query) =>
        query.table === "media_items"
          ? { data: null, error: cause }
          : {
              data: {
                season_number: 1,
                episode_count: 0,
                watched_count: 0,
                total_runtime: 0,
                average_rating: null,
                total: 0,
                episodes: [],
              },
            };
      await expect(getSeasonEpisodes(seriesId, seasonId, 1, 20)).rejects.toMatchObject({
        name: "MediaRepositoryError",
        message: "Media repository operation failed: fetch season summary",
        cause,
      });
      await expect(getSeasonEpisodes(seriesId, seasonId, 1, 20)).rejects.toBeInstanceOf(MediaRepositoryError);
    } finally {
      log.mockRestore();
    }
  });
});
