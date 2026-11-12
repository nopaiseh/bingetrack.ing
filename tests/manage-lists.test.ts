import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nameOrAliasFilter, titleOrAliasFilter } from "@/lib/admin/catalog";
import {
  ADMIN_BULK_MAX_IDS,
  ADMIN_LIST_MAX_PAGE_SIZE,
  AdminInputError,
  parseAdminMediaQuery,
  parseAdminPeopleQuery,
  parseBulkIds,
  parseBulkStatus,
} from "@/lib/admin/list-params";
import {
  bulkDeleteMovies,
  bulkDeletePeople,
  bulkDeleteTvShows,
  bulkSetMovieStatus,
  bulkSetTvShowStatus,
  listAdminMedia,
  listAdminPeople,
} from "@/lib/admin/lists";
import { deleteMovies, listPeople, setTvShowStatus } from "@/app/(admin)/manage/list-actions";
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
    for (const method of ["select", "order", "range", "or", "in", "eq", "delete", "upsert"]) {
      builder[method] = (...args: unknown[]) => {
        query.calls.push({ method, args });
        return builder;
      };
    }
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
    const { db, queries } = fakeDb((query) => query.table === "people" ? {
      data: [{ id: personA, name: "周星驰", alternate_name: "星爷", media_credits: [{ count: 4 }] }],
      count: 773,
    } : {});
    const page = await listAdminPeople(db, { page: 2, pageSize: 10, q: "100%", sort: "alternate_name", direction: "desc" });
    const people = queries[0];
    expect(people.calls[0]).toEqual({ method: "select", args: ["id,name,alternate_name,media_credits(count)", { count: "exact" }] });
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
      if (query.table === "v_manage_media_order") return {
        data: [
          { id: movieB, title: "后", alternate_title: null, status: "watched", rating: "8.5", sort_date: "2024-02-02" },
          { id: movieA, title: "先", alternate_title: "Earlier", status: null, rating: null, sort_date: "2020-01-01" },
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
    expect(page.items[0]).toMatchObject({ status: "watched", rating: 8.5, runtime: 100, season_count: 0, episode_count: 0 });
    expect(page.items[1]).toMatchObject({ status: "want_to_watch", rating: null, runtime: 90, alternate_title: "Earlier", cover_url: "https://image.tmdb.org/a" });
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
    const { db } = fakeDb((query) => query.table === "v_manage_media_order" ? {
      data: [{ id: showA, title: "节目", alternate_title: null, status: "watching", rating: 7, sort_date: "2024-05-01" }],
      count: 1,
    } : {
      data: [{
        id: showA,
        cover_url: null,
        release_date: null,
        runtime: null,
        seasons: [{ episodes: [{ count: 3 }] }, { episodes: [{ count: 2 }] }],
      }],
    });
    const page = await listAdminMedia(db, "tv_show", { sort: "title" });
    expect(page.items[0]).toMatchObject({ season_count: 2, episode_count: 5, status: "watching", sort_date: "2024-05-01" });
  });

  it("非法排序不会查询数据库", async () => {
    const { db, from } = fakeDb(() => ({}));
    await expect(listAdminMedia(db, "movie", { sort: "music" })).rejects.toThrow(AdminInputError);
    expect(from).not.toHaveBeenCalled();
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

    const rejected = fakeDb((query) => query.table === "people" ? { data: null, error: { code: "23503" } } : { data: [] });
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
    const { db, queries, rpc } = fakeDb((query) => query.table === "media_items" ? { data: [{ id: showA, title: "人生切割术" }] } : {});
    rpc.mockImplementation(async (fn, args) => {
      const error: { code?: string } | null = fn === "admin_delete_media" && args.p_id === showA ? null : { code: "P0002" };
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
    const { db, rpc } = fakeDb(() => ({ data: [{ id: showA, title: "甲" }, { id: showB, title: "乙" }] }));
    rpc.mockImplementation(async (fn, args) => {
      const error: { code?: string } | null = fn === "admin_delete_media" && args.p_id === showB ? { code: "22023" } : null;
      return { data: null, error };
    });
    expect(await bulkDeleteTvShows(db, [showA, showB])).toEqual({ succeeded: 1, failed: 1 });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("电影状态只更新确认过的电影，且不带评分字段", async () => {
    const { db, queries } = fakeDb((query) => query.table === "media_items" ? { data: [{ id: movieA }] } : { data: [{ media_item_id: movieA }] });
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

    const want = fakeDb((query) => query.table === "media_items" ? { data: [{ id: showA }] } : { data: [] });
    expect(await bulkSetTvShowStatus(want.db, [showA], "want_to_watch")).toEqual({ succeeded: 1, failed: 0 });
    expect(want.queries.some((query) => query.table === "tracking")).toBe(false);
    expect(revalidateMediaItems).not.toHaveBeenCalled();
  });

  it("电视节目状态写入其全部单集，并按 max_rows 继续翻页", async () => {
    const { db, queries } = fakeDb((query) => {
      if (query.table === "media_items") return { data: [{ id: showA }] };
      if (query.table === "tv_episodes") {
        const start = calls(query, "range")[0]?.args[0];
        if (start === 0) return { data: Array.from({ length: 1000 }, () => ({ id: episodeA, tv_seasons: { series_id: showA } })) };
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
  });

  it("身份通过后才查询", async () => {
    const { db, from } = fakeDb(() => ({ data: [], count: 0 }));
    vi.mocked(requireOwner).mockResolvedValue({ db, user: {} } as unknown as Awaited<ReturnType<typeof requireOwner>>);
    await expect(listPeople({ sort: "id" })).rejects.toThrow(AdminInputError);
    expect(from).not.toHaveBeenCalled();
    expect(await listPeople({ q: "" })).toEqual({ items: [], total: 0, page: 1, pageSize: 25 });
    expect(from).toHaveBeenCalledWith("people");
  });
});
