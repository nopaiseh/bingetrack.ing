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
      for (const method of ["select", "eq", "neq", "in", "order", "limit", "gte", "lte", "range"]) {
        builder[method] = chain(method);
      }
      const finish = () => ({ data: [], error: null, ...state.handle(query) });
      builder.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(finish()).then(resolve, reject);
      return builder;
    },
  }),
}));

import { getSitemapMediaEntries, MediaRepositoryError } from "@/lib/functions/media-repo";
import { SEARCH_DB_TYPES } from "@/lib/media-types";

const movieId = "11111111-1111-4111-8111-111111111111";
const songId = "50000000-0000-4000-8000-000000000021";
const personId = "40000000-0000-4000-8000-000000000005";
const seasonId = "33333333-3333-4333-8333-333333333333";
const showId = "22222222-2222-4222-8222-222222222222";

function args(query: Query, method: string) {
  return query.calls.find((call) => call.method === method)?.args;
}

describe("getSitemapMediaEntries", () => {
  beforeEach(() => {
    state.queries = [];
    state.handle = () => ({ data: [], error: null });
  });

  it("收录目录媒体、歌曲、季与有公开作品的人物", async () => {
    state.handle = (query) => {
      if (query.table === "v_all_media") {
        return {
          data: [
            { id: movieId, type: "movie" },
            { id: songId, type: "music" },
          ],
        };
      }
      if (query.table === "tv_seasons") {
        return { data: [{ id: seasonId, series_id: showId }] };
      }
      if (query.table === "people") {
        return { data: [{ id: personId }] };
      }
      return { data: [] };
    };

    const entries = await getSitemapMediaEntries();
    expect(entries).toEqual([
      { path: `/movies/${movieId}` },
      { path: `/music/${songId}` },
      { path: `/shows/${showId}/seasons/${seasonId}` },
      { path: `/people/${personId}` },
    ]);

    const mediaQuery = state.queries.find((query) => query.table === "v_all_media");
    expect(mediaQuery).toBeDefined();
    expect(args(mediaQuery!, "in")).toEqual(["type", [...SEARCH_DB_TYPES]]);
    expect(args(mediaQuery!, "range")).toEqual([0, 999]);

    const peopleQuery = state.queries.find((query) => query.table === "people");
    expect(peopleQuery).toBeDefined();
    expect(String(args(peopleQuery!, "select")?.[0])).toContain("media_credits!inner");
    expect(args(peopleQuery!, "in")).toEqual(["media_credits.media_items.type", [...SEARCH_DB_TYPES]]);
  });

  it("无公开路径的类型不收录；空人物／空季结果不产生条目", async () => {
    state.handle = (query) => {
      if (query.table === "v_all_media") {
        return {
          data: [
            { id: movieId, type: "movie" },
            // tv_episode 不在 SEARCH_DB_TYPES 查询里；若仍返回则 publicPathForDbType 为 null，应丢弃。
            { id: "66666666-6666-4666-8666-666666666666", type: "tv_episode" },
            { id: songId, type: "music" },
          ],
        };
      }
      if (query.table === "tv_seasons") return { data: [] };
      if (query.table === "people") return { data: [] };
      return { data: [] };
    };

    const entries = await getSitemapMediaEntries();
    expect(entries).toEqual([{ path: `/movies/${movieId}` }, { path: `/music/${songId}` }]);
    expect(entries.some((entry) => entry.path.includes("tv_episode") || entry.path.includes("66666666"))).toBe(false);
  });

  it("人物查询失败抛出 MediaRepositoryError", async () => {
    state.handle = (query) => {
      if (query.table === "v_all_media") return { data: [] };
      if (query.table === "tv_seasons") return { data: [] };
      if (query.table === "people") return { error: { message: "db", code: "57014" } };
      return { data: [] };
    };

    await expect(getSitemapMediaEntries()).rejects.toBeInstanceOf(MediaRepositoryError);
  });

  it("媒体与人物均按 1000 行分页拉取", async () => {
    const mediaPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}`,
      type: "music" as const,
    }));
    const peoplePage = Array.from({ length: 1000 }, (_, index) => ({
      id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index).padStart(12, "0")}`,
    }));
    let mediaCalls = 0;
    let peopleCalls = 0;

    state.handle = (query) => {
      if (query.table === "v_all_media") {
        mediaCalls += 1;
        return { data: mediaCalls === 1 ? mediaPage : [{ id: songId, type: "music" }] };
      }
      if (query.table === "tv_seasons") return { data: [] };
      if (query.table === "people") {
        peopleCalls += 1;
        return { data: peopleCalls === 1 ? peoplePage : [{ id: personId }] };
      }
      return { data: [] };
    };

    const entries = await getSitemapMediaEntries();
    expect(mediaCalls).toBe(2);
    expect(peopleCalls).toBe(2);
    expect(entries).toHaveLength(1000 + 1 + 1000 + 1);
    expect(entries.some((entry) => entry.path === `/music/${songId}`)).toBe(true);
    expect(entries.some((entry) => entry.path === `/people/${personId}`)).toBe(true);

    const mediaRanges = state.queries
      .filter((query) => query.table === "v_all_media")
      .map((query) => args(query, "range"));
    expect(mediaRanges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);

    const peopleRanges = state.queries.filter((query) => query.table === "people").map((query) => args(query, "range"));
    expect(peopleRanges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });
});
