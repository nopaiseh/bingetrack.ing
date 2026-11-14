import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";
import { requireOwner } from "@/lib/auth/server";
import { deleteMovies, deleteTvShows, setMovieStatus, setTvShowStatus } from "@/app/(admin)/manage/list-actions";
import { deleteMedia, saveMedia } from "@/app/(admin)/manage/actions";
import { getContinueWatching } from "@/lib/continue-watching";
import { getCachedContinueWatching } from "@/lib/functions/cached-media";

const cacheSpecs = vi.hoisted(() => [] as Array<{ fn: unknown; keys: unknown; options: unknown }>);

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown, keys: unknown, options: unknown) => {
    cacheSpecs.push({ fn, keys, options });
    return fn;
  },
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ requireOwner: vi.fn() }));
vi.mock("@/lib/continue-watching", () => ({
  getContinueWatching: vi.fn(async () => []),
}));
vi.mock("@/lib/admin/revalidate-media", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/revalidate-media")>();
  return {
    ...actual,
    affectedMediaIds: vi.fn(async (_db: unknown, ids: string[]) => ids),
  };
});

const movieA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const showA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const episodeA = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const seasonA = "22222222-2222-4222-8222-222222222222";

type Result = { data?: unknown; error?: { code?: string } | null };
type Query = { table: string };

/** 记录表名，由每个用例按表返回行。链的末尾可 await，也可 maybeSingle。 */
function fakeDb(handle: (query: Query) => Result) {
  const from = vi.fn((table: string) => {
    const query = { table };
    const result = () => ({ data: [], error: null, ...handle(query) });
    const builder: Record<string, unknown> = {
      then: (resolve: (value: Result) => void) => resolve(result()),
      maybeSingle: () => Promise.resolve(result()),
    };
    for (const method of ["select", "order", "range", "or", "in", "eq", "delete", "upsert"]) {
      builder[method] = () => builder;
    }
    return builder;
  });
  const rpc = vi.fn(async (): Promise<{ data: string | null; error: { code?: string } | null }> => ({ data: movieA, error: null }));
  return { db: { from, rpc } as unknown as SupabaseClient, rpc };
}

function useDb(handle: (query: Query) => Result) {
  const built = fakeDb(handle);
  vi.mocked(requireOwner).mockResolvedValue({ db: built.db, user: {} } as unknown as Awaited<ReturnType<typeof requireOwner>>);
  return built;
}

function episodeForm() {
  const form = new FormData();
  form.set("type", "tv_episode");
  form.set("title", "第 1 集");
  form.set("parent_id", seasonA);
  form.set("number", "1");
  form.set("rating", "8");
  return form;
}

beforeEach(() => {
  vi.mocked(revalidateTag).mockClear();
  vi.mocked(getContinueWatching).mockClear();
});

describe("继续看数据缓存", () => {
  it("用 24 小时和 media、media:lists 包住 getContinueWatching，并原样返回它的结果", async () => {
    const item = {
      showId: showA,
      title: "节目",
      posterPath: "/poster.jpg",
      href: `/shows/${showA}`,
      nextEpisode: null,
      seasonProgress: { seasonNumber: 1, watched: 1, total: 2 },
      lastWatchedAt: "2024-01-01T00:00:00.000Z",
    };
    vi.mocked(getContinueWatching).mockResolvedValue([item]);

    expect(cacheSpecs).toContainEqual({
      fn: getContinueWatching,
      keys: ["public-media-continue-watching-v1"],
      options: { revalidate: 86400, tags: ["media", "media:lists"] },
    });
    await expect(getCachedContinueWatching()).resolves.toEqual([item]);
    expect(getContinueWatching).toHaveBeenCalledOnce();
  });
});

describe("观看写入失效继续看缓存", () => {
  it("批量把电影标成已看时失效 media:lists", async () => {
    useDb((query) => query.table === "media_items" ? { data: [{ id: movieA }] } : { data: [{ media_item_id: movieA }] });
    await setMovieStatus([movieA], "watched");
    expect(revalidateTag).toHaveBeenCalledWith("media:lists", { expire: 0 });
  });

  it("批量把电视节目标成已看时失效 media:lists", async () => {
    useDb((query) => {
      if (query.table === "media_items") return { data: [{ id: showA }] };
      if (query.table === "tv_episodes") return { data: [{ id: episodeA, tv_seasons: { series_id: showA } }] };
      return { data: [{ media_item_id: episodeA }] };
    });
    await setTvShowStatus([showA], "watched");
    expect(revalidateTag).toHaveBeenCalledWith("media:lists", { expire: 0 });
  });

  it("删除电影或电视节目时失效 media:lists", async () => {
    useDb(() => ({ data: [{ id: movieA }] }));
    await deleteMovies([movieA]);
    expect(revalidateTag).toHaveBeenCalledWith("media:lists", { expire: 0 });

    vi.mocked(revalidateTag).mockClear();
    const shows = useDb(() => ({ data: [{ id: showA, title: "节目" }] }));
    shows.rpc.mockResolvedValue({ data: null, error: null });
    await deleteTvShows([showA]);
    expect(revalidateTag).toHaveBeenCalledWith("media:lists", { expire: 0 });
  });

  it("保存带评分的单集（记为已看）和删除条目时失效 media:lists", async () => {
    const saved = useDb(() => ({ data: null }));
    saved.rpc.mockResolvedValue({ data: episodeA, error: null });
    await saveMedia({}, episodeForm());
    expect(revalidateTag).toHaveBeenCalledWith("media:lists", { expire: 0 });

    vi.mocked(revalidateTag).mockClear();
    const removed = useDb(() => ({ data: { type: "tv_episode" } }));
    removed.rpc.mockResolvedValue({ data: null, error: null });
    const form = new FormData();
    form.set("id", episodeA);
    form.set("confirm_title", "第 1 集");
    await deleteMedia({}, form);
    expect(revalidateTag).toHaveBeenCalledWith("media:lists", { expire: 0 });
  });

  it("观看状态没有写进数据库时不失效", async () => {
    useDb((query) => query.table === "tracking" ? { data: null, error: { code: "XX000" } } : { data: [{ id: movieA }] });
    await expect(setMovieStatus([movieA], "watched")).rejects.toThrow("状态更新失败");
    expect(revalidateTag).not.toHaveBeenCalled();

    useDb(() => ({ data: [] }));
    await deleteMovies([movieA]);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
