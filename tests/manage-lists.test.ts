import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nameOrAliasFilter, titleOrAliasFilter } from "@/lib/admin/catalog";
import {
  ADMIN_BULK_MAX_IDS,
  ADMIN_LIST_MAX_PAGE,
  ADMIN_LIST_MAX_PAGE_SIZE,
  AdminInputError,
  parseAdminChildListType,
  parseAdminChildQuery,
  parseAdminMediaQuery,
  parseAdminPeopleQuery,
  parseBulkIds,
  parseBulkStatus,
} from "@/lib/admin/list-params";
import {
  bulkDeleteAlbums,
  bulkDeleteMovies,
  bulkDeletePeople,
  bulkDeleteTvShows,
  bulkSetMovieStatus,
  bulkSetTvShowStatus,
  listAdminChildren,
  listAdminMedia,
  listAdminPeople,
} from "@/lib/admin/lists";
import { deleteAlbums, deleteMovies, listAlbums, listPeople, setTvShowStatus } from "@/app/(admin)/manage/list-actions";
import { requireOwner } from "@/lib/auth/server";
import { affectedMediaIds, referenceMediaIds, revalidateMediaItems } from "@/lib/admin/revalidate-media";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ requireOwner: vi.fn() }));
vi.mock("@/lib/admin/revalidate-media", () => ({
  affectedMediaIds: vi.fn(async (_db: unknown, ids: string[]) => ids),
  referenceMediaIds: vi.fn(async () => ["33333333-3333-4333-8333-333333333333"]),
  revalidateMediaItems: vi.fn(),
}));

const personA = "11111111-1111-4111-8111-111111111111";
const personB = "22222222-2222-4222-8222-222222222222";
const movieA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const movieB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const showA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const showB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const episodeA = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const albumA = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const albumB = "99999999-9999-4999-8999-999999999999";
const trackA = "10101010-1010-4010-8010-101010101010";
const trackB = "20202020-2020-4020-8020-202020202020";

type Result = { data?: unknown; error?: unknown; count?: number | null };
type QueryCall = { method: string; args: unknown[] };
type Query = { table: string; calls: QueryCall[] };

function calls(query: Query, method: string) {
  return query.calls.filter((call) => call.method === method);
}

/** 记录每次查询的方法参数，由处理函数按表名返回结果。 */
function fakeDb(handle: (query: Query) => Result) {
  const queries: Query[] = [];
  const from = vi.fn((table: string) => {
    const query: Query = { table, calls: [] };
    queries.push(query);
    const builder: Record<string, unknown> = {
      then: (resolve: (value: Result) => void) => resolve({ data: [], error: null, ...handle(query) }),
    };
    for (const method of ["select", "order", "range", "or", "in", "eq", "delete", "upsert", "not"]) {
      builder[method] = (...args: unknown[]) => {
        query.calls.push({ method, args });
        return builder;
      };
    }
    builder.maybeSingle = () => Promise.resolve({ data: null, error: null, count: null, ...handle(query) });
    return builder;
  });
  const rpc = vi.fn<(fn: string, args: { p_id: string }) => Promise<{ data: null; error: { code?: string } | null }>>(
    async () => ({ data: null, error: null }),
  );
  return { db: { from, rpc } as unknown as SupabaseClient, queries, from, rpc };
}

describe("管理列表参数", () => {
  it("默认页码、页大小和排序，并把过大的页大小截断到 100", () => {
    expect(parseAdminPeopleQuery({})).toEqual({ page: 1, pageSize: 25, q: "", sort: "name", direction: "asc" });
    expect(parseAdminMediaQuery({ page: "2", pageSize: "250", q: "  星际  " })).toEqual({
      page: 2,
      pageSize: ADMIN_LIST_MAX_PAGE_SIZE,
      q: "星际",
      sort: "date",
      direction: "desc",
    });
  });

  it("只接受白名单里的排序字段和方向", () => {
    expect(parseAdminMediaQuery({ sort: "rating", direction: "asc" }).direction).toBe("asc");
    expect(parseAdminPeopleQuery({ sort: "alternate_name" }).direction).toBe("asc");
    expect(() => parseAdminPeopleQuery({ sort: "id" })).toThrow(AdminInputError);
    expect(() => parseAdminMediaQuery({ sort: "release_date" })).toThrow(AdminInputError);
    expect(() => parseAdminMediaQuery({ direction: "DESC" })).toThrow(AdminInputError);
    expect(() => parseAdminPeopleQuery({ page: "0" })).toThrow(AdminInputError);
    expect(() => parseAdminPeopleQuery({ pageSize: "0" })).toThrow(AdminInputError);
    expect(() => parseAdminPeopleQuery({ q: "x".repeat(201) })).toThrow(AdminInputError);
  });

  it("批量 ID 去重、拒绝空值和超长批次，状态不接受 watching", () => {
    expect(parseBulkIds([personA, personA.toUpperCase(), personB])).toEqual([personA, personB]);
    expect(() => parseBulkIds([])).toThrow(AdminInputError);
    expect(() => parseBulkIds(["not-a-uuid"])).toThrow(AdminInputError);
    expect(() => parseBulkIds(Array.from({ length: ADMIN_BULK_MAX_IDS + 1 }, () => personA))).toThrow(AdminInputError);
    expect(parseBulkStatus("watched")).toBe("watched");
    expect(() => parseBulkStatus("watching")).toThrow(/watching/);
  });
});

describe("人物与影视列表查询", () => {
  it("人物按姓名搜索、精确计数并按白名单排序", async () => {
    const { db, queries } = fakeDb((query) =>
      query.table === "people"
        ? {
            data: [{ id: personA, name: "周星驰", alternate_name: "星爷", media_credits: [{ count: 4 }] }],
            count: 773,
          }
        : {},
    );
    const page = await listAdminPeople(db, {
      page: 2,
      pageSize: 10,
      q: "100%",
      sort: "alternate_name",
      direction: "desc",
    });
    const people = queries[0];
    expect(people.calls[0]).toEqual({
      method: "select",
      args: ["id,name,alternate_name,media_credits(count)", { count: "exact" }],
    });
    expect(calls(people, "or")[0].args).toEqual([nameOrAliasFilter("100%")]);
    expect(calls(people, "order").map((call) => call.args)).toEqual([
      ["alternate_name", { ascending: false, nullsFirst: false }],
      ["id", { ascending: true }],
    ]);
    expect(calls(people, "range")[0].args).toEqual([10, 19]);
    expect(page).toEqual({
      items: [{ id: personA, name: "周星驰", alternate_name: "星爷", credit_count: 4 }],
      total: 773,
      page: 2,
      pageSize: 10,
    });
    expect(queries).toHaveLength(1);
  });

  it("空白搜索不附加过滤，计数缺失时不返回空列表", async () => {
    const { db, queries } = fakeDb(() => ({ data: [], count: 0 }));
    await listAdminPeople(db, { q: "   " });
    expect(calls(queries[0], "or")).toHaveLength(0);
    const missing = fakeDb(() => ({ data: [], count: null }));
    await expect(listAdminPeople(missing.db, {})).rejects.toThrow("无法读取管理列表");
  });

  it("电影按排序视图分页，再按原顺序补封面和季集数", async () => {
    const { db, queries } = fakeDb((query) => {
      if (query.table === "v_manage_media_order")
        return {
          data: [
            {
              id: movieB,
              title: "后",
              alternate_title: null,
              status: "watched",
              rating: "8.5",
              sort_date: "2024-02-02",
            },
            {
              id: movieA,
              title: "先",
              alternate_title: "Earlier",
              status: null,
              rating: null,
              sort_date: "2020-01-01",
            },
          ],
          count: 40,
        };
      return {
        data: [
          { id: movieA, cover_url: "https://image.tmdb.org/a", release_date: "2020-01-01", runtime: "90", seasons: [] },
          { id: movieB, cover_url: null, release_date: "2024-02-02", runtime: 100, seasons: null },
        ],
      };
    });
    const page = await listAdminMedia(db, "movie", { q: "100%", sort: "rating", direction: "asc" });
    const ordered = queries[0];
    expect(calls(ordered, "eq")[0].args).toEqual(["type", "movie"]);
    expect(calls(ordered, "or")[0].args).toEqual([titleOrAliasFilter("100%")]);
    expect(calls(ordered, "select")[0].args[1]).toEqual({ count: "exact" });
    expect(calls(ordered, "order").map((call) => call.args[0])).toEqual(["rating", "title", "id"]);
    expect(calls(ordered, "range")[0].args).toEqual([0, 24]);
    expect(page.total).toBe(40);
    expect(page.items.map((item) => item.id)).toEqual([movieB, movieA]);
    expect(page.items[0]).toMatchObject({
      status: "watched",
      rating: 8.5,
      runtime: 100,
      season_count: 0,
      episode_count: 0,
    });
    expect(page.items[1]).toMatchObject({
      status: "want_to_watch",
      rating: null,
      runtime: 90,
      alternate_title: "Earlier",
      cover_url: "https://image.tmdb.org/a",
    });
    expect(queries[1].table).toBe("media_items");
  });

  it("电视节目默认按日期倒序，空页不再读取详情", async () => {
    const { db, queries } = fakeDb(() => ({ data: [], count: 0 }));
    const page = await listAdminMedia(db, "tv_show", {});
    expect(calls(queries[0], "order")[0].args).toEqual(["sort_date", { ascending: false, nullsFirst: false }]);
    expect(page).toEqual({ items: [], total: 0, page: 1, pageSize: 25 });
    expect(queries).toHaveLength(1);
  });

  it("季集数量来自嵌入计数", async () => {
    const { db } = fakeDb((query) =>
      query.table === "v_manage_media_order"
        ? {
            data: [
              {
                id: showA,
                title: "节目",
                alternate_title: null,
                status: "watching",
                rating: 7,
                sort_date: "2024-05-01",
              },
            ],
            count: 1,
          }
        : {
            data: [
              {
                id: showA,
                cover_url: null,
                release_date: null,
                runtime: null,
                seasons: [{ episodes: [{ count: 3 }] }, { episodes: [{ count: 2 }] }],
              },
            ],
          },
    );
    const page = await listAdminMedia(db, "tv_show", { sort: "title" });
    expect(page.items[0]).toMatchObject({
      season_count: 2,
      episode_count: 5,
      status: "watching",
      sort_date: "2024-05-01",
    });
  });

  it("非法排序不会查询数据库", async () => {
    const { db, from } = fakeDb(() => ({}));
    await expect(listAdminMedia(db, "movie", { sort: "music" })).rejects.toThrow(AdminInputError);
    expect(from).not.toHaveBeenCalled();
  });

  it("专辑列表附带曲目数量", async () => {
    const { db, queries } = fakeDb((query) => {
      if (query.table === "v_manage_media_order") {
        return {
          data: [
            {
              id: albumA,
              title: "专辑甲",
              alternate_title: null,
              status: "watched",
              rating: 9,
              sort_date: "2024-01-01",
            },
          ],
          count: 1,
        };
      }
      if (query.table === "media_items") {
        return {
          data: [{ id: albumA, cover_url: null, release_date: "2024-01-01", runtime: null, seasons: [] }],
        };
      }
      if (query.table === "music") {
        return { data: [{ album_id: albumA }, { album_id: albumA }, { album_id: null }] };
      }
      if (query.table === "music_albums") {
        return { data: [{ media_item_id: albumA, track_count: 12 }] };
      }
      return {};
    });
    const page = await listAdminMedia(db, "album", {});
    // 有实际曲目时以实际数为准，忽略过期的 music_albums.track_count
    expect(page.items[0]).toMatchObject({ type: "album", track_count: 2, season_count: 0, episode_count: 0 });
    expect(queries.some((query) => query.table === "music")).toBe(true);
    expect(queries.some((query) => query.table === "music_albums")).toBe(true);
  });
});

describe("季与单集列表", () => {
  const seasonId = "12121212-1212-4121-8121-121212121212";
  const seasonB = "13131313-1313-4131-8131-131313131313";
  const episodeId = "34343434-3434-4343-8343-343434343434";
  const readError = "无法读取管理列表，请稍后重试。";

  it("默认日期倒序和空筛选，页码夹在 1 到上限，搜索词只截断", () => {
    expect(parseAdminChildQuery("tv_episode", undefined, {})).toEqual({
      page: 1,
      pageSize: 25,
      q: "",
      sort: "date",
      status: "",
      parent: "",
    });
    expect(parseAdminChildQuery("tv_episode", "  ", { page: "0" }).page).toBe(1);
    expect(parseAdminChildQuery("tv_episode", null, { page: "-4" }).page).toBe(1);
    expect(parseAdminChildQuery("tv_episode", null, { page: "12abc" }).page).toBe(12);
    expect(parseAdminChildQuery("tv_episode", null, { page: "nope" }).page).toBe(1);
    expect(parseAdminChildQuery("tv_season", null, { page: String(ADMIN_LIST_MAX_PAGE + 1) }).page).toBe(
      ADMIN_LIST_MAX_PAGE,
    );
    expect(parseAdminChildQuery("tv_episode", null, { q: `  ${"x".repeat(250)}` }).q).toHaveLength(200);
    expect(parseAdminChildQuery("tv_episode", null, { q: "  星  " }).q).toBe("  星  ");
    expect(parseAdminChildQuery("tv_episode", null, { pageSize: "100" }).pageSize).toBe(25);
  });

  it("排序、状态和上级只接受白名单，季不能按评分排序，单集不接受在看", () => {
    expect(parseAdminChildQuery("tv_episode", showA, { sort: "rating", status: "watching" })).toMatchObject({
      sort: "rating",
      status: "",
      parent: showA,
    });
    expect(parseAdminChildQuery("tv_episode", showA, { status: "watched" }).status).toBe("watched");
    expect(parseAdminChildQuery("tv_episode", showA, { status: "want_to_watch" }).status).toBe("want_to_watch");
    expect(parseAdminChildQuery("tv_season", showA, { status: "watching" }).status).toBe("watching");
    expect(parseAdminChildQuery("tv_season", showA.toUpperCase(), { sort: "rating", status: "watched" })).toMatchObject(
      {
        sort: "date",
        status: "watched",
        parent: showA.toUpperCase(),
      },
    );
    expect(
      parseAdminChildQuery("tv_episode", "not-a-uuid", { sort: "item_number", status: "watched,id.neq.0" }),
    ).toMatchObject({
      sort: "date",
      status: "",
      parent: "",
    });
    expect(parseAdminChildQuery("tv_season", showA, { sort: "title", status: "want_to_watch" }).sort).toBe("title");
    expect(parseAdminChildListType("tv_episode")).toBe("tv_episode");
    expect(parseAdminChildListType("music")).toBe("music");
    expect(parseAdminChildQuery("music", albumA, { sort: "title", status: "watched" })).toMatchObject({
      sort: "title",
      status: "watched",
      parent: albumA,
    });
    expect(() => parseAdminChildListType("movie")).toThrow(AdminInputError);
    expect(() => parseAdminChildListType("tv_show")).toThrow(AdminInputError);
  });

  it("季按排序视图分页，状态和日期取视图，不使用条目自身的观看记录", async () => {
    const { db, queries } = fakeDb((query) => {
      if (query.table === "v_manage_media_order")
        return {
          data: [
            { id: seasonB, status: "watching", rating: 9, sort_date: "2025-03-01" },
            { id: seasonId, status: null, rating: null, sort_date: "2024-01-01" },
          ],
          count: 30,
        };
      return {
        data: [
          {
            id: seasonId,
            title: "第 1 季",
            alternate_title: null,
            type: "tv_season",
            cover_url: null,
            release_date: "2020-01-01",
            tracking: { status: "watched", rating: 9 },
            tv_seasons: { season_number: 1, parent: { title: "人生切割术" }, episodes: [{ count: 9 }] },
            tv_episodes: null,
          },
          {
            id: seasonB,
            title: "第 2 季",
            alternate_title: "Two",
            type: "tv_season",
            cover_url: "https://image.tmdb.org/s.jpg",
            release_date: null,
            tracking: null,
            tv_seasons: { season_number: 2, parent: null, episodes: [{ count: "3" }] },
            tv_episodes: null,
          },
        ],
      };
    });
    const page = await listAdminChildren(db, "tv_season", showA, {
      q: "100%",
      status: "watching",
      sort: "title",
      page: "2",
    });
    const ordered = queries[0];
    expect(ordered.table).toBe("v_manage_media_order");
    expect(calls(ordered, "select")[0].args).toEqual(["id, status, rating, sort_date", { count: "exact" }]);
    expect(calls(ordered, "eq").map((call) => call.args)).toEqual([
      ["type", "tv_season"],
      ["parent_id", showA],
      ["status", "watching"],
    ]);
    expect(calls(ordered, "or")[0].args).toEqual([titleOrAliasFilter("100%")]);
    expect(calls(ordered, "order").map((call) => call.args)).toEqual([
      ["title"],
      ["sort_date", { ascending: false, nullsFirst: false }],
      ["item_number", { ascending: false, nullsFirst: false }],
      ["title"],
      ["id"],
    ]);
    expect(calls(ordered, "range")[0].args).toEqual([25, 49]);
    expect(queries[1].table).toBe("media_items");
    const detailColumns = String(calls(queries[1], "select")[0].args[0]);
    expect(detailColumns).toContain("tracking(status,rating)");
    expect(detailColumns).toContain("tv_seasons!tv_seasons_id_fkey(season_number,");
    expect(detailColumns).toContain("episodes:tv_episodes!tv_episodes_season_id_fkey(count)");
    expect(detailColumns).toContain("tv_episodes!tv_episodes_id_fkey(episode_number,");
    expect(detailColumns).not.toContain("!inner");
    expect(detailColumns).not.toContain("runtime");
    expect(detailColumns).not.toContain("seasons:tv_seasons");
    expect(detailColumns).not.toMatch(/[(,]series_id[,)]/);
    expect(detailColumns).not.toMatch(/[(,]season_id[,)]/);
    expect(calls(queries[1], "in")[0].args).toEqual(["id", [seasonB, seasonId]]);
    expect(page.total).toBe(30);
    expect(page.items.map((item) => item.id)).toEqual([seasonB, seasonId]);
    expect(page.items[0]).toMatchObject({
      type: "tv_season",
      title: "第 2 季",
      status: "watching",
      rating: null,
      display_date: "2025-03-01",
      cover_url: "https://image.tmdb.org/s.jpg",
      season: { seriesTitle: null, seasonNumber: 2, episodeCount: 3 },
      episode: null,
    });
    expect(page.items[1]).toMatchObject({
      status: "want_to_watch",
      rating: null,
      display_date: "2024-01-01",
      season: { seriesTitle: "人生切割术", episodeCount: 9 },
    });
    expect(page.sort).toBe("title");
  });

  it("单集的状态和评分来自 tracking，日期来自上映日，评分排序写在最前", async () => {
    const { db, queries } = fakeDb((query) =>
      query.table === "v_manage_media_order"
        ? {
            data: [{ id: episodeId, status: "want_to_watch", rating: 1, sort_date: "2024-06-01" }],
            count: 1,
          }
        : {
            data: [
              {
                id: episodeId,
                title: "启程",
                alternate_title: null,
                type: "tv_episode",
                cover_url: null,
                release_date: "2024-06-02",
                tracking: [{ status: "watched", rating: "8.5" }],
                tv_seasons: null,
                tv_episodes: {
                  episode_number: 8,
                  parent: { media_items: { title: "第 1 季" }, series: { title: "人生切割术" } },
                },
              },
            ],
          },
    );
    const page = await listAdminChildren(db, "tv_episode", seasonId, { sort: "rating", status: "watched" });
    expect(calls(queries[0], "order").map((call) => call.args[0])).toEqual([
      "rating",
      "sort_date",
      "item_number",
      "title",
      "id",
    ]);
    expect(calls(queries[0], "eq").map((call) => call.args)).toEqual([
      ["type", "tv_episode"],
      ["parent_id", seasonId],
      ["status", "watched"],
    ]);
    expect(page.items[0]).toMatchObject({
      status: "watched",
      rating: 8.5,
      display_date: "2024-06-02",
      season: null,
      episode: { seriesTitle: "人生切割术", seasonTitle: "第 1 季", episodeNumber: 8 },
    });
  });

  it("空白页不再读取详情，非法排序和状态不会进入查询", async () => {
    const { db, queries, from } = fakeDb(() => ({ data: [], count: 0 }));
    const page = await listAdminChildren(db, "tv_episode", "not-a-uuid", {
      q: "   ",
      sort: "release_date",
      status: "dropped",
    });
    expect(page).toMatchObject({ items: [], total: 0, page: 1, pageSize: 25, sort: "date", status: "", parent: "" });
    expect(queries).toHaveLength(1);
    expect(calls(queries[0], "or")).toHaveLength(1);
    expect(calls(queries[0], "order").map((call) => call.args[0])).toEqual(["sort_date", "item_number", "title", "id"]);
    expect(calls(queries[0], "eq").map((call) => call.args[0])).toEqual(["type"]);
    await expect(listAdminChildren(db, "movie", null, {})).rejects.toThrow(AdminInputError);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("单集列表不把 watching 写进查询，季列表仍然按在看筛选", async () => {
    const episodes = fakeDb(() => ({ data: [], count: 0 }));
    const episodePage = await listAdminChildren(episodes.db, "tv_episode", seasonId, { status: "watching" });
    expect(episodePage.status).toBe("");
    expect(calls(episodes.queries[0], "eq").map((call) => call.args)).toEqual([
      ["type", "tv_episode"],
      ["parent_id", seasonId],
    ]);

    const seasons = fakeDb(() => ({ data: [], count: 0 }));
    const seasonPage = await listAdminChildren(seasons.db, "tv_season", showA, { status: "watching" });
    expect(seasonPage.status).toBe("watching");
    expect(calls(seasons.queries[0], "eq").map((call) => call.args)).toEqual([
      ["type", "tv_season"],
      ["parent_id", showA],
      ["status", "watching"],
    ]);
  });

  it("视图或详情查询失败时抛出原来的提示，且不退回逐条查询", async () => {
    const missing = fakeDb(() => ({
      data: null,
      error: { code: "PGRST205", message: "Could not find the table" },
      count: null,
    }));
    await expect(listAdminChildren(missing.db, "tv_season", showA, {})).rejects.toSatisfy(
      (error: Error) => error.message === readError && !error.message.includes("PGRST205"),
    );
    expect(missing.queries.map((query) => query.table)).toEqual(["v_manage_media_order"]);

    const denied = fakeDb((query) =>
      query.table === "media_items"
        ? { data: null, error: { code: "42501", message: "permission denied" } }
        : { data: [{ id: seasonId, status: "watched", rating: null, sort_date: "2024-01-01" }], count: 1 },
    );
    await expect(listAdminChildren(denied.db, "tv_season", null, {})).rejects.toThrow(readError);
    expect(denied.queries.map((query) => query.table)).toEqual(["v_manage_media_order", "media_items"]);
    expect(denied.queries.some((query) => query.table === "tv_seasons" || query.table === "tv_episodes")).toBe(false);
  });
});

describe("批量删除与状态", () => {
  beforeEach(() => {
    vi.mocked(affectedMediaIds).mockClear();
    vi.mocked(referenceMediaIds).mockClear();
    vi.mocked(revalidateMediaItems).mockClear();
  });

  it("删除人物时排除仍被专辑引用的 ID，并在删除前收集受影响条目", async () => {
    const { db, queries, from } = fakeDb((query) => {
      if (query.table === "music_albums") return { data: [{ artist_id: personB.toUpperCase() }] };
      return { data: [{ id: personA }] };
    });
    const result = await bulkDeletePeople(db, [personA, personB, personA]);
    expect(queries.map((query) => query.table)).toEqual(["music_albums", "people"]);
    expect(calls(queries[0], "delete")).toHaveLength(0);
    expect(calls(queries[1], "in")[0].args).toEqual(["id", [personA]]);
    expect(vi.mocked(referenceMediaIds).mock.invocationCallOrder[0]).toBeLessThan(from.mock.invocationCallOrder[1]);
    expect(revalidateMediaItems).toHaveBeenCalledWith(["33333333-3333-4333-8333-333333333333"]);
    expect(result).toEqual({ succeeded: 1, failed: 1 });
  });

  it("人物全部被外键挡住时不删除，语句被拒绝时整批记为失败且不刷新缓存", async () => {
    const blocked = fakeDb(() => ({ data: [{ artist_id: personA }] }));
    expect(await bulkDeletePeople(blocked.db, [personA])).toEqual({ succeeded: 0, failed: 1 });
    expect(blocked.queries).toHaveLength(1);
    expect(revalidateMediaItems).not.toHaveBeenCalled();

    const rejected = fakeDb((query) =>
      query.table === "people" ? { data: null, error: { code: "23503" } } : { data: [] },
    );
    expect(await bulkDeletePeople(rejected.db, [personA])).toEqual({ succeeded: 0, failed: 1 });
    expect(revalidateMediaItems).not.toHaveBeenCalled();
  });

  it("电影一次按类型删除，不存在的 ID 记为失败", async () => {
    const { db, queries, from } = fakeDb(() => ({ data: [{ id: movieA }] }));
    const result = await bulkDeleteMovies(db, [movieA, movieB]);
    expect(queries).toHaveLength(1);
    expect(queries[0].calls.map((call) => call.method)).toEqual(["delete", "in", "eq", "select"]);
    expect(calls(queries[0], "eq")[0].args).toEqual(["type", "movie"]);
    expect(vi.mocked(affectedMediaIds).mock.invocationCallOrder[0]).toBeLessThan(from.mock.invocationCallOrder[0]);
    expect(revalidateMediaItems).toHaveBeenCalledWith([movieA, movieB]);
    expect(result).toEqual({ succeeded: 1, failed: 1 });
  });

  it("没有删掉任何电影时不刷新缓存", async () => {
    const { db } = fakeDb(() => ({ data: [] }));
    expect(await bulkDeleteMovies(db, [showA])).toEqual({ succeeded: 0, failed: 1 });
    expect(revalidateMediaItems).not.toHaveBeenCalled();
  });

  it("电视节目逐个调用 admin_delete_media，不用一条 DELETE 留下孤立的季集行", async () => {
    const { db, queries, rpc } = fakeDb((query) =>
      query.table === "media_items" ? { data: [{ id: showA, title: "人生切割术" }] } : {},
    );
    rpc.mockImplementation(async (fn, args) => {
      const error: { code?: string } | null =
        fn === "admin_delete_media" && args.p_id === showA ? null : { code: "P0002" };
      return { data: null, error };
    });
    const result = await bulkDeleteTvShows(db, [showA, showB]);
    expect(queries.some((query) => calls(query, "delete").length > 0)).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("admin_delete_media", { p_id: showA, p_confirm_title: "人生切割术" });
    expect(vi.mocked(affectedMediaIds).mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
    expect(result).toEqual({ succeeded: 1, failed: 1 });
  });

  it("单个节目删除失败不影响其余节目的计数", async () => {
    const { db, rpc } = fakeDb(() => ({
      data: [
        { id: showA, title: "甲" },
        { id: showB, title: "乙" },
      ],
    }));
    rpc.mockImplementation(async (fn, args) => {
      const error: { code?: string } | null =
        fn === "admin_delete_media" && args.p_id === showB ? { code: "22023" } : null;
      return { data: null, error };
    });
    expect(await bulkDeleteTvShows(db, [showA, showB])).toEqual({ succeeded: 1, failed: 1 });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("电影状态只更新确认过的电影，且不带评分字段", async () => {
    const { db, queries } = fakeDb((query) =>
      query.table === "media_items" ? { data: [{ id: movieA }] } : { data: [{ media_item_id: movieA }] },
    );
    const result = await bulkSetMovieStatus(db, [movieA, showA], "watched");
    const upsert = calls(queries[1], "upsert")[0].args;
    expect(queries[1].table).toBe("tracking");
    expect(upsert[0]).toEqual([{ media_item_id: movieA, status: "watched" }]);
    expect(upsert[1]).toEqual({ onConflict: "media_item_id", defaultToNull: false });
    expect(JSON.stringify(upsert[0])).not.toContain("rating");
    expect(result).toEqual({ succeeded: 1, failed: 1 });
    expect(revalidateMediaItems).toHaveBeenCalled();
  });

  it("没有单集的节目不能标成已看，想看则计为成功且不写 tracking", async () => {
    const watched = fakeDb((query) => {
      if (query.table === "media_items") return { data: [{ id: showA }] };
      return { data: [] };
    });
    expect(await bulkSetTvShowStatus(watched.db, [showA], "watched")).toEqual({ succeeded: 0, failed: 1 });
    expect(watched.queries.some((query) => query.table === "tracking")).toBe(false);

    const want = fakeDb((query) => (query.table === "media_items" ? { data: [{ id: showA }] } : { data: [] }));
    expect(await bulkSetTvShowStatus(want.db, [showA], "want_to_watch")).toEqual({ succeeded: 1, failed: 0 });
    expect(want.queries.some((query) => query.table === "tracking")).toBe(false);
    expect(revalidateMediaItems).not.toHaveBeenCalled();
  });

  it("电视节目状态写入其全部单集，并按 max_rows 继续翻页", async () => {
    const { db, queries } = fakeDb((query) => {
      if (query.table === "media_items") return { data: [{ id: showA }] };
      if (query.table === "tv_episodes") {
        const start = calls(query, "range")[0]?.args[0];
        if (start === 0)
          return { data: Array.from({ length: 1000 }, () => ({ id: episodeA, tv_seasons: { series_id: showA } })) };
        return { data: [{ id: episodeA, tv_seasons: [{ series_id: showA }] }] };
      }
      return { data: [] };
    });
    const result = await bulkSetTvShowStatus(db, [showA, movieA], "want_to_watch");
    const episodeQueries = queries.filter((query) => query.table === "tv_episodes");
    expect(episodeQueries).toHaveLength(2);
    expect(calls(episodeQueries[0], "in")[0].args).toEqual(["tv_seasons.series_id", [showA]]);
    expect(calls(episodeQueries[1], "range")[0].args).toEqual([1000, 1999]);
    const tracking = queries.find((query) => query.table === "tracking");
    const rows = calls(tracking!, "upsert")[0].args[0] as { media_item_id: string; status: string }[];
    expect(rows).toEqual([{ media_item_id: episodeA, status: "want_to_watch" }]);
    expect(result).toEqual({ succeeded: 1, failed: 1 });
  });

  it("非法 ID 或 watching 不会访问数据库", async () => {
    const { db, from } = fakeDb(() => ({}));
    await expect(bulkDeleteMovies(db, ["nope"])).rejects.toThrow(AdminInputError);
    await expect(bulkSetMovieStatus(db, [movieA], "watching")).rejects.toThrow(AdminInputError);
    expect(from).not.toHaveBeenCalled();
  });

  it("批量删除专辑前先删下属曲目", async () => {
    const { db, queries } = fakeDb((query) => {
      if (query.table === "media_items" && query.calls.some((call) => call.method === "select")) {
        return {
          data: [
            { id: albumA, title: "专辑甲" },
            { id: albumB, title: "专辑乙" },
          ],
        };
      }
      if (query.table === "music") {
        return { data: [{ media_item_id: trackA }, { media_item_id: trackB }, { media_item_id: trackA }] };
      }
      if (query.table === "media_items" && query.calls.some((call) => call.method === "delete")) {
        const ids = calls(query, "in")[0]?.args[1] as string[];
        if (ids?.includes(trackA)) return { data: null };
        return { data: [{ id: albumA }, { id: albumB }] };
      }
      return { data: [] };
    });
    const result = await bulkDeleteAlbums(db, [albumA, albumB, albumA]);
    expect(result).toEqual({ succeeded: 2, failed: 0 });
    const deletes = queries.filter((query) => query.table === "media_items" && calls(query, "delete").length > 0);
    expect(calls(deletes[0], "in")[0].args[1]).toEqual([trackA, trackB]);
    expect(revalidateMediaItems).toHaveBeenCalled();
  });

  it("没有匹配专辑时全部记失败且不删曲目", async () => {
    const { db, from } = fakeDb(() => ({ data: [] }));
    expect(await bulkDeleteAlbums(db, [albumA])).toEqual({ succeeded: 0, failed: 1 });
    expect(from).toHaveBeenCalledWith("media_items");
    expect(from).not.toHaveBeenCalledWith("music");
  });
});

describe("专辑曲目列表", () => {
  it("无上级时返回空页，不查库", async () => {
    const { db, from } = fakeDb(() => ({}));
    expect(await listAdminChildren(db, "music", null, {})).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
      q: "",
      sort: "date",
      status: "",
      parent: "",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("按曲序读取并支持搜索、状态与评分排序", async () => {
    const { db, queries } = fakeDb((query) => {
      if (query.table === "media_items") return { data: { title: "所属专辑" } };
      if (query.table === "music") {
        return {
          data: [
            {
              media_item_id: trackB,
              track_number: 2,
              media: {
                id: trackB,
                title: "乙曲",
                alternate_title: "B",
                cover_url: null,
                release_date: "2024-02-01",
                tracking: { status: "want_to_watch", rating: 6 },
              },
            },
            {
              media_item_id: trackA,
              track_number: 1,
              media: [
                {
                  id: trackA,
                  title: "甲曲",
                  alternate_title: null,
                  cover_url: "https://coverartarchive.org/a.jpg",
                  release_date: "2024-01-01",
                  tracking: [{ status: "watched", rating: "9" }],
                },
              ],
            },
          ],
        };
      }
      return {};
    });
    const page = await listAdminChildren(db, "music", albumA, { sort: "rating", q: "曲", status: "watched" });
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      id: trackA,
      type: "music",
      title: "甲曲",
      status: "watched",
      rating: 9,
      track: { albumTitle: "所属专辑", trackNumber: 1 },
    });
    expect(queries[0].table).toBe("media_items");
    expect(queries[1].table).toBe("music");
    expect(calls(queries[1], "eq")[0].args).toEqual(["album_id", albumA]);
  });
});

describe("管理列表服务端入口", () => {
  beforeEach(() => {
    vi.mocked(requireOwner).mockReset();
  });

  it("每个入口先检查站长身份", async () => {
    vi.mocked(requireOwner).mockRejectedValue(new Error("unauthorized"));
    await expect(listPeople({ q: "周星驰" })).rejects.toThrow("unauthorized");
    await expect(deleteMovies([movieA])).rejects.toThrow("unauthorized");
    await expect(setTvShowStatus([showA], "watched")).rejects.toThrow("unauthorized");
    await expect(listAlbums({})).rejects.toThrow("unauthorized");
    await expect(deleteAlbums([albumA])).rejects.toThrow("unauthorized");
  });

  it("身份通过后才查询", async () => {
    const { db, from } = fakeDb(() => ({ data: [], count: 0 }));
    vi.mocked(requireOwner).mockResolvedValue({ db, user: {} } as unknown as Awaited<ReturnType<typeof requireOwner>>);
    await expect(listPeople({ sort: "id" })).rejects.toThrow(AdminInputError);
    expect(from).not.toHaveBeenCalled();
    expect(await listPeople({ q: "" })).toEqual({ items: [], total: 0, page: 1, pageSize: 25 });
    expect(from).toHaveBeenCalledWith("people");
    from.mockClear();
    expect(await listAlbums({})).toEqual({ items: [], total: 0, page: 1, pageSize: 25 });
    expect(from).toHaveBeenCalledWith("v_manage_media_order");
  });
});
