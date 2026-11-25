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
    };
  },
}));

vi.mock("@/lib/report-error", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/report-error")>();
  return { ...actual, reportHandledError: vi.fn() };
});

import { reportHandledError } from "@/lib/report-error";
import { getAlbumDetail } from "@/lib/functions/album-repo";
import { MediaRepositoryError } from "@/lib/functions/media-repo";

const albumId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const trackA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const trackB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function args(query: Query, method: string) {
  return query.calls.find((call) => call.method === method)?.args;
}

function albumViewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: albumId,
    type: "album",
    title: "叶惠美",
    alternate_title: "Ye Hui Mei",
    sort_date: "2003-07-31",
    release_year: "2003",
    rating: 9.2,
    genres: ["流行"],
    languages: ["国语"],
    regions: ["台湾"],
    cover_url: "https://cover.example/ye.jpg",
    summary: "周杰伦第四张专辑",
    artists: ["周杰伦"],
    status: null,
    ...overrides,
  };
}

describe("专辑详情查询 getAlbumDetail", () => {
  beforeEach(() => {
    state.builds = 0;
    state.queries = [];
    state.handle = () => ({ data: null, error: null });
    vi.mocked(reportHandledError).mockClear();
  });

  it("组装元数据、拥有权、曲目与 credits，曲序升序", async () => {
    state.handle = (query) => {
      if (query.table === "v_all_media") return { data: albumViewRow() };
      if (query.table === "music_albums") return { data: { track_count: 11, label: " 阿尔发音乐 " } };
      if (query.table === "ownership") return { data: { status: "owned" } };
      if (query.table === "music") {
        return {
          data: [
            {
              media_item_id: trackA,
              track_number: 1,
              media: {
                id: trackA,
                title: "以父之名",
                runtime: 341,
                tracking: { status: "watched", rating: 9.5 },
              },
            },
            {
              media_item_id: trackB,
              track_number: 2,
              media: [
                {
                  id: trackB,
                  title: "晴天",
                  runtime: null,
                  tracking: [{ status: "want_to_watch", rating: null }],
                },
              ],
            },
          ],
        };
      }
      if (query.table === "media_credits") {
        return {
          data: [
            { media_item_id: trackA, role: "artist", credit_order: 1, people: { name: "周杰伦" } },
            { media_item_id: trackA, role: "lyricist", credit_order: 1, people: [{ name: "方文山" }] },
            { media_item_id: trackA, role: "composer", credit_order: 1, people: { name: "周杰伦" } },
            { media_item_id: trackB, role: "artist", credit_order: 1, people: { name: "  " } },
            { media_item_id: trackB, role: "lyricist", credit_order: 1, people: null },
          ],
        };
      }
      if (query.table === "media_genres") {
        return {
          data: [
            { media_item_id: trackA, genres: { name: "流行" } },
            { media_item_id: trackA, genres: [{ name: "说唱" }] },
            { media_item_id: trackB, genres: null },
          ],
        };
      }
      return { data: null };
    };

    const detail = await getAlbumDetail(albumId);
    expect(detail).toMatchObject({
      media: { id: albumId, title: "叶惠美", type: "albums", series: [] },
      artists: ["周杰伦"],
      trackCount: 2,
      label: "阿尔发音乐",
      ratedCount: 1,
      ownership: "owned",
      series: [],
    });
    expect(detail?.tracks).toEqual([
      {
        id: trackA,
        trackNumber: 1,
        title: "以父之名",
        singers: ["周杰伦"],
        lyricists: ["方文山"],
        composers: ["周杰伦"],
        genres: ["流行", "说唱"],
        durationSeconds: 341,
        status: "watched",
        rating: 9.5,
      },
      {
        id: trackB,
        trackNumber: 2,
        title: "晴天",
        singers: [],
        lyricists: [],
        composers: [],
        genres: [],
        durationSeconds: null,
        status: "want_to_watch",
        rating: null,
      },
    ]);

    const music = state.queries.find((query) => query.table === "music");
    expect(args(music!, "eq")).toEqual(["album_id", albumId]);
    expect(music!.calls.filter((call) => call.method === "order").map((call) => call.args)).toEqual([
      ["track_number", { ascending: true, nullsFirst: false }],
      ["media_item_id", { ascending: true }],
    ]);
    const credits = state.queries.find((query) => query.table === "media_credits");
    expect(args(credits!, "in")).toEqual(["media_item_id", [trackA, trackB]]);
    const genres = state.queries.find((query) => query.table === "media_genres");
    expect(args(genres!, "in")).toEqual(["media_item_id", [trackA, trackB]]);
    const membership = state.queries.find((query) => query.table === "media_item_series");
    expect(args(membership!, "select")).toEqual(["position, media_series(name)"]);
    expect(args(membership!, "eq")).toEqual(["media_item_id", albumId]);
  });

  it("非法 ID 不访问数据库；视图缺失或非专辑返回 null", async () => {
    expect(await getAlbumDetail("not-a-uuid")).toBeNull();
    expect(state.builds).toBe(0);

    state.handle = () => ({ data: null });
    expect(await getAlbumDetail(albumId)).toBeNull();
    expect(state.queries.map((query) => query.table).sort()).toEqual(
      ["music", "music_albums", "ownership", "v_all_media"].sort(),
    );

    state.queries = [];
    state.handle = (query) =>
      query.table === "v_all_media" ? { data: albumViewRow({ type: "movie", title: "电影" }) } : { data: null };
    expect(await getAlbumDetail(albumId)).toBeNull();
    expect(state.queries.some((query) => query.table === "media_credits")).toBe(false);
  });

  it("无曲目时回退 music_albums.track_count，缺省标题与空艺人可处理", async () => {
    state.handle = (query) => {
      if (query.table === "v_all_media") return { data: albumViewRow({ artists: null, title: "空专辑" }) };
      if (query.table === "music_albums") return { data: { track_count: 12, label: null } };
      if (query.table === "ownership") return { data: null };
      if (query.table === "music") {
        return {
          data: [
            {
              media_item_id: trackA,
              track_number: null,
              media: { id: trackA, title: "  ", runtime: 0, tracking: null },
            },
          ],
        };
      }
      return { data: [] };
    };

    const detail = await getAlbumDetail(albumId);
    expect(detail).toMatchObject({
      trackCount: 1,
      label: null,
      ownership: null,
      ratedCount: 0,
      artists: [],
    });
    expect(detail?.tracks[0]).toMatchObject({
      title: "未命名曲目",
      trackNumber: null,
      genres: [],
      durationSeconds: 0,
      status: null,
      rating: null,
    });
  });

  it("视图／专辑元数据／曲目查询失败抛出 MediaRepositoryError", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const viewError = { code: "42501", message: "permission denied" };
      state.handle = (query) => (query.table === "v_all_media" ? { data: null, error: viewError } : { data: null });
      await expect(getAlbumDetail(albumId)).rejects.toMatchObject({
        name: "MediaRepositoryError",
        message: "Media repository operation failed: fetch album view",
        cause: viewError,
      });
      await expect(getAlbumDetail(albumId)).rejects.toBeInstanceOf(MediaRepositoryError);

      state.handle = (query) => {
        if (query.table === "v_all_media") return { data: albumViewRow() };
        if (query.table === "music_albums") return { data: null, error: { message: "meta down" } };
        return { data: null };
      };
      await expect(getAlbumDetail(albumId)).rejects.toMatchObject({
        message: "Media repository operation failed: fetch album meta",
      });

      state.handle = (query) => {
        if (query.table === "v_all_media") return { data: albumViewRow() };
        if (query.table === "music_albums") return { data: { track_count: 1, label: null } };
        if (query.table === "ownership") return { data: null };
        if (query.table === "music") return { data: null, error: { message: "tracks down" } };
        return { data: null };
      };
      await expect(getAlbumDetail(albumId)).rejects.toMatchObject({
        message: "Media repository operation failed: fetch album tracks",
      });
    } finally {
      log.mockRestore();
    }
  });

  it("ownership 与 credits 失败只上报，仍返回详情", async () => {
    state.handle = (query) => {
      if (query.table === "v_all_media") return { data: albumViewRow() };
      if (query.table === "music_albums") return { data: { track_count: null, label: "索尼" } };
      if (query.table === "ownership") return { data: null, error: { code: "42501" } };
      if (query.table === "music") {
        return {
          data: [
            {
              media_item_id: trackA,
              track_number: 1,
              media: { id: trackA, title: "轨道", runtime: 120, tracking: { status: null, rating: 8 } },
            },
          ],
        };
      }
      if (query.table === "media_credits") return { data: null, error: { message: "credits down" } };
      return { data: null };
    };

    const detail = await getAlbumDetail(albumId);
    expect(detail).toMatchObject({
      ownership: null,
      label: "索尼",
      ratedCount: 1,
      tracks: [{ id: trackA, singers: [], lyricists: [], composers: [], genres: [], rating: 8 }],
      series: [],
    });
    expect(reportHandledError).toHaveBeenCalledWith(`Failed to fetch ownership for album ${albumId}:`, {
      code: "42501",
    });
    expect(reportHandledError).toHaveBeenCalledWith(`Failed to fetch track credits for album ${albumId}:`, {
      message: "credits down",
    });
  });

  it("返回系列名称、当前序位与同系列其他条目（含 seriesPosition）", async () => {
    const siblingA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const siblingB = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    let membershipPass = 0;
    state.handle = (query) => {
      if (query.table === "v_all_media") {
        if (args(query, "eq")?.[0] === "id" && args(query, "eq")?.[1] === albumId) {
          return { data: albumViewRow() };
        }
        return {
          data: [
            {
              id: siblingB,
              type: "album",
              title: "范特西",
              sort_date: "2001-09-14",
              release_year: "2001",
              cover_url: "https://cover.example/fantasy.jpg",
            },
            {
              id: siblingA,
              type: "album",
              title: "八度空间",
              sort_date: "2002-07-19",
              release_year: "2002",
              cover_url: "https://cover.example/oct.jpg",
            },
          ],
        };
      }
      if (query.table === "music_albums") return { data: { track_count: 0, label: null } };
      if (query.table === "ownership") return { data: null };
      if (query.table === "music") return { data: [] };
      if (query.table === "media_item_series") {
        membershipPass += 1;
        // 第一次：当前专辑的成员关系；之后是 getRelatedBySeries 的同系列查询。
        if (membershipPass === 1) {
          return {
            data: [
              { position: 3, media_series: { name: "杰伦专辑" } },
              { position: null, media_series: [{ name: "华语经典" }] },
              { position: 1, media_series: { name: "" } },
              { position: 2, media_series: null },
            ],
          };
        }
        return {
          data: [
            { media_item_id: siblingB, position: 1 },
            { media_item_id: siblingA, position: 2 },
          ],
        };
      }
      return { data: null };
    };

    const detail = await getAlbumDetail(albumId);
    expect(detail?.media.series).toEqual(["华语经典", "杰伦专辑"]);
    expect(detail?.series).toEqual([
      {
        name: "杰伦专辑",
        position: 3,
        items: [
          expect.objectContaining({
            id: siblingB,
            title: "范特西",
            cover_url: "https://cover.example/fantasy.jpg",
            date: "2001-09-14",
            release_year: "2001",
            type: "albums",
            seriesPosition: 1,
          }),
          expect.objectContaining({
            id: siblingA,
            title: "八度空间",
            cover_url: "https://cover.example/oct.jpg",
            date: "2002-07-19",
            release_year: "2002",
            type: "albums",
            seriesPosition: 2,
          }),
        ],
      },
      {
        name: "华语经典",
        position: null,
        items: [
          expect.objectContaining({ id: siblingB, seriesPosition: 1 }),
          expect.objectContaining({ id: siblingA, seriesPosition: 2 }),
        ],
      },
    ]);
  });

  it("系列成员查询失败只上报，系列降级为空数组", async () => {
    state.handle = (query) => {
      if (query.table === "v_all_media") return { data: albumViewRow() };
      if (query.table === "music_albums") return { data: { track_count: 0, label: null } };
      if (query.table === "ownership") return { data: null };
      if (query.table === "music") return { data: [] };
      if (query.table === "media_item_series") return { data: null, error: { code: "42501" } };
      return { data: null };
    };

    const detail = await getAlbumDetail(albumId);
    expect(detail).toMatchObject({
      media: { series: [] },
      series: [],
    });
    expect(reportHandledError).toHaveBeenCalledWith(`Failed to fetch series memberships for album ${albumId}:`, {
      code: "42501",
    });
  });
});
