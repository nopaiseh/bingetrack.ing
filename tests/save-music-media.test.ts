import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteMusicTree,
  saveAlbumWithTracks,
  saveMusicMedia,
  SaveMusicMediaError,
} from "@/lib/admin/save-music-media";
import type { MediaInput } from "@/lib/admin/media-form";
import { findMusicDuplicateId } from "@/lib/music/dedupe";
import { resolveMusicCover } from "@/lib/music/resolve-cover";

vi.mock("@/lib/music/dedupe", async () => {
  const actual = await vi.importActual<typeof import("@/lib/music/dedupe")>("@/lib/music/dedupe");
  return {
    ...actual,
    findMusicDuplicateId: vi.fn(async () => null),
  };
});
vi.mock("@/lib/music/resolve-cover", () => ({
  resolveMusicCover: vi.fn(async () => "https://is1-ssl.mzstatic.com/image/thumb/Music/auto.jpg"),
}));

const albumId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const albumB = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const trackId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherTrack = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function albumPayload(overrides: Partial<MediaInput> = {}): MediaInput {
  return {
    id: null,
    type: "album",
    title: "新专辑",
    alternate_title: null,
    summary: null,
    cover_url: null,
    release_date: "2024-05-01",
    runtime: null,
    parent_id: null,
    number: null,
    disc_number: null,
    status: "want_to_watch",
    rating: null,
    genres: ["流行"],
    languages: [],
    regions: [],
    actors: [],
    directors: [],
    artists: [{ id: null, name: "艺人" }],
    lyricists: [],
    composers: [],
    authors: [],
    page_count: null,
    publisher: null,
    isbn: null,
    label: "厂牌",
    collections: [],
    ...overrides,
  };
}

function trackPayload(overrides: Partial<MediaInput> = {}): MediaInput {
  return {
    id: null,
    type: "music",
    title: "新曲目",
    alternate_title: null,
    summary: null,
    cover_url: "https://coverartarchive.org/release/x/front-500",
    release_date: "2024-05-01",
    runtime: 200,
    parent_id: albumId,
    number: 1,
    disc_number: null,
    status: "watched",
    rating: 8,
    genres: [],
    languages: [],
    regions: [],
    actors: [],
    directors: [],
    artists: [{ id: null, name: "主唱" }],
    lyricists: [{ id: null, name: "作词" }],
    composers: [{ id: null, name: "作曲" }],
    authors: [],
    page_count: null,
    publisher: null,
    isbn: null,
    label: null,
    collections: [],
    ...overrides,
  };
}

function chainResult(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  const finish = async () => result;
  for (const method of ["select", "eq", "neq", "is", "in", "order", "limit", "not"]) {
    builder[method] = () => builder;
  }
  builder.maybeSingle = finish;
  builder.single = finish;
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    finish().then(resolve, reject);
  return builder;
}

/** 曲目保存前：专辑存在校验与同专辑查重。 */
function trackGuardFrom(options?: {
  albumExists?: boolean;
  siblingTracks?: { media_item_id: string; title: string; artists?: string[] }[];
}) {
  const albumExists = options?.albumExists ?? true;
  const siblings = options?.siblingTracks ?? [];
  return (table: string) => {
    if (table === "media_items") {
      return {
        select: () => chainResult({ data: albumExists ? { id: albumId } : null, error: null }),
      };
    }
    if (table === "album_tracks") {
      return {
        select: () =>
          chainResult({
            data: siblings.map((row) => ({
              song_id: row.media_item_id,
              media: { id: row.media_item_id, title: row.title },
            })),
            error: null,
          }),
      };
    }
    if (table === "media_credits") {
      return {
        select: () =>
          chainResult({
            data: siblings.flatMap((row) =>
              (row.artists ?? []).map((name) => ({
                media_item_id: row.media_item_id,
                people: { name },
              })),
            ),
            error: null,
          }),
      };
    }
    throw new Error(table);
  };
}

function dbWithRpc(
  rpcImpl: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>,
  fromImpl?: (table: string) => unknown,
) {
  return {
    from: fromImpl ?? vi.fn(),
    rpc: vi.fn(rpcImpl),
  };
}

describe("saveMusicMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findMusicDuplicateId).mockResolvedValue(null);
    vi.mocked(resolveMusicCover).mockResolvedValue("https://is1-ssl.mzstatic.com/image/thumb/Music/auto.jpg");
  });

  it("拒绝非专辑／曲目类型", async () => {
    await expect(
      saveMusicMedia({ from: vi.fn(), rpc: vi.fn() } as never, albumPayload({ type: "movie" })),
    ).rejects.toThrow(/只支持专辑与曲目/);
  });

  it("新建专辑时解析封面并调用 admin_save_album_with_tracks", async () => {
    const db = dbWithRpc(async () => ({ data: { id: albumId, affected_person_ids: [] }, error: null }));
    const id = await saveMusicMedia(db as never, albumPayload({ languages: ["国语"], regions: ["台湾"] }));
    expect(id).toBe(albumId);
    expect(db.rpc).toHaveBeenCalledWith(
      "admin_save_album_with_tracks",
      expect.objectContaining({
        p_album: expect.objectContaining({
          type: "album",
          title: "新专辑",
          cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music/auto.jpg",
          label: "厂牌",
          credits: [{ person: { name: "艺人" }, role: "artist", order: 0 }],
          // 语言记在单曲上；专辑 RPC 负载不发 languages。
          languages: [],
          regions: ["台湾"],
        }),
        p_tracks: [],
      }),
    );
    expect(findMusicDuplicateId).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "album", title: "新专辑" }),
    );
  });

  it("更新已有专辑：附带 collections 写入 RPC", async () => {
    const db = dbWithRpc(async () => ({ data: { id: albumId, affected_person_ids: [] }, error: null }));
    const id = await saveMusicMedia(
      db as never,
      albumPayload({
        id: albumId,
        cover_url: "https://coverartarchive.org/release/x/front-500",
        artists: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "艺人" }],
        genres: [],
        collections: ["精选"],
      }),
    );
    expect(id).toBe(albumId);
    expect(resolveMusicCover).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledWith(
      "admin_save_album_with_tracks",
      expect.objectContaining({
        p_album: expect.objectContaining({
          id: albumId,
          collections: ["精选"],
        }),
      }),
    );
  });

  it("新建曲目前校验所属专辑存在，并调用 admin_save_media", async () => {
    const from = vi.fn(trackGuardFrom());
    const db = dbWithRpc(async () => ({ data: { id: trackId, affected_person_ids: [] }, error: null }), from);
    const id = await saveMusicMedia(db as never, trackPayload());
    expect(id).toBe(trackId);
    expect(findMusicDuplicateId).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledWith(
      "admin_save_media",
      expect.objectContaining({
        p_data: expect.objectContaining({
          type: "music",
          parent_id: albumId,
          number: 1,
          runtime: 200,
          status: "watched",
          rating: 8,
        }),
      }),
    );
  });

  it("曲目不调用 resolveMusicCover；提交封面也强制写入 null", async () => {
    const from = vi.fn(trackGuardFrom());
    const db = dbWithRpc(async () => ({ data: { id: trackId, affected_person_ids: [] }, error: null }), from);
    await saveMusicMedia(db as never, trackPayload({ cover_url: null }));
    expect(resolveMusicCover).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledWith(
      "admin_save_media",
      expect.objectContaining({
        p_data: expect.objectContaining({ type: "music", cover_url: null }),
      }),
    );

    vi.mocked(resolveMusicCover).mockClear();
    const db2 = dbWithRpc(
      async () => ({ data: { id: trackId, affected_person_ids: [] }, error: null }),
      vi.fn(trackGuardFrom()),
    );
    const submitted = "https://coverartarchive.org/release/x/front-500";
    await saveMusicMedia(db2 as never, trackPayload({ cover_url: submitted }));
    expect(resolveMusicCover).not.toHaveBeenCalled();
    expect(db2.rpc).toHaveBeenCalledWith(
      "admin_save_media",
      expect.objectContaining({
        p_data: expect.objectContaining({ type: "music", cover_url: null }),
      }),
    );
  });

  it("所属专辑不存在时拒绝保存曲目", async () => {
    const from = vi.fn(trackGuardFrom({ albumExists: false }));
    await expect(saveMusicMedia({ from, rpc: vi.fn() } as never, trackPayload())).rejects.toThrow(/所属专辑不存在/);
  });

  it("专辑全库查重命中时拒绝", async () => {
    vi.mocked(findMusicDuplicateId).mockResolvedValue("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    await expect(saveMusicMedia({ from: vi.fn(), rpc: vi.fn() } as never, albumPayload())).rejects.toThrow(
      /已存在同名同艺人的专辑/,
    );
  });

  it("同一专辑内同名同歌手曲目拒绝，不同专辑同名同歌手可保存", async () => {
    const blocked = vi.fn(
      trackGuardFrom({
        siblingTracks: [{ media_item_id: otherTrack, title: "新曲目", artists: ["主唱"] }],
      }),
    );
    await expect(saveMusicMedia({ from: blocked, rpc: vi.fn() } as never, trackPayload())).rejects.toThrow(
      /已存在同名同艺人的曲目/,
    );

    const from = vi.fn(trackGuardFrom({ albumExists: true, siblingTracks: [] }));
    const db = dbWithRpc(async () => ({ data: { id: trackId, affected_person_ids: [] }, error: null }), from);
    await expect(saveMusicMedia(db as never, trackPayload({ parent_id: albumB }))).resolves.toBe(trackId);
    expect(findMusicDuplicateId).not.toHaveBeenCalled();
  });

  it("曲序冲突由 RPC 返回 23505 并映射文案", async () => {
    const from = vi.fn(trackGuardFrom());
    const db = dbWithRpc(async () => ({ data: null, error: { code: "23505" } }), from);
    await expect(saveMusicMedia(db as never, trackPayload())).rejects.toThrow(/曲序/);
  });

  it("曲目 runtime 越界在调用 RPC 前拒绝", async () => {
    await expect(
      saveMusicMedia({ from: vi.fn(), rpc: vi.fn() } as never, trackPayload({ runtime: 0 })),
    ).rejects.toThrow(/1–7200/);
    await expect(
      saveMusicMedia({ from: vi.fn(), rpc: vi.fn() } as never, trackPayload({ runtime: 7201 })),
    ).rejects.toThrow(/1–7200/);
  });

  it("曲目类型超过 2 个在调用 RPC 前拒绝；RPC 文案可映射", async () => {
    await expect(
      saveMusicMedia({ from: vi.fn(), rpc: vi.fn() } as never, trackPayload({ genres: ["流行", "说唱", "摇滚"] })),
    ).rejects.toThrow(/类型最多 2 个/);

    const from = vi.fn(trackGuardFrom());
    const db = dbWithRpc(
      async () => ({
        data: null,
        error: { code: "22023", message: "Music tracks allow at most 2 genres" },
      }),
      from,
    );
    await expect(saveMusicMedia(db as never, trackPayload({ genres: ["流行", "说唱"] }))).rejects.toThrow(
      /类型最多 2 个/,
    );
  });

  it("曲目带 0／1／2 个类型写入 admin_save_media 负载", async () => {
    const from = vi.fn(trackGuardFrom());
    const db = dbWithRpc(async () => ({ data: { id: trackId, affected_person_ids: [] }, error: null }), from);
    await saveMusicMedia(db as never, trackPayload({ genres: [] }));
    expect(db.rpc).toHaveBeenLastCalledWith(
      "admin_save_media",
      expect.objectContaining({ p_data: expect.objectContaining({ genres: [] }) }),
    );
    await saveMusicMedia(db as never, trackPayload({ genres: ["流行"] }));
    expect(db.rpc).toHaveBeenLastCalledWith(
      "admin_save_media",
      expect.objectContaining({ p_data: expect.objectContaining({ genres: ["流行"] }) }),
    );
    await saveMusicMedia(db as never, trackPayload({ genres: ["流行", "说唱"] }));
    expect(db.rpc).toHaveBeenLastCalledWith(
      "admin_save_media",
      expect.objectContaining({ p_data: expect.objectContaining({ genres: ["流行", "说唱"] }) }),
    );
  });

  it("曲目语言写入 RPC；地区不发；专辑不发语言", async () => {
    const from = vi.fn(trackGuardFrom());
    const db = dbWithRpc(async () => ({ data: { id: trackId, affected_person_ids: [] }, error: null }), from);
    await saveMusicMedia(db as never, trackPayload({ languages: ["国语", "粤语"], regions: ["台湾"] }));
    expect(db.rpc).toHaveBeenCalledWith(
      "admin_save_media",
      expect.objectContaining({
        p_data: expect.objectContaining({
          type: "music",
          languages: ["国语", "粤语"],
          regions: [],
        }),
      }),
    );

    const albumDb = dbWithRpc(async () => ({ data: { id: albumId, affected_person_ids: [] }, error: null }));
    await saveMusicMedia(albumDb as never, albumPayload({ languages: ["日语"], regions: ["日本"] }));
    expect(albumDb.rpc).toHaveBeenCalledWith(
      "admin_save_album_with_tracks",
      expect.objectContaining({
        p_album: expect.objectContaining({ languages: [], regions: ["日本"] }),
      }),
    );
  });

  it("RPC 校验失败（23514）映射为时长文案", async () => {
    const from = vi.fn(trackGuardFrom());
    const db = dbWithRpc(
      async () => ({ data: null, error: { code: "23514", message: "media_items_music_runtime_seconds_check" } }),
      from,
    );
    await expect(saveMusicMedia(db as never, trackPayload({ runtime: 100 }))).rejects.toThrow(/1–7200/);
  });

  it("权限不足映射为站长权限文案", async () => {
    const db = dbWithRpc(async () => ({ data: null, error: { code: "42501" } }));
    await expect(saveMusicMedia(db as never, albumPayload())).rejects.toThrow(/没有写入权限/);
  });
});

describe("saveAlbumWithTracks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findMusicDuplicateId).mockResolvedValue(null);
    vi.mocked(resolveMusicCover).mockResolvedValue("https://is1-ssl.mzstatic.com/image/thumb/Music/auto.jpg");
  });

  it("新建专辑时跳过曲目所属专辑存在检查，一次 RPC 提交全部曲目", async () => {
    const db = dbWithRpc(async () => ({ data: { id: albumId, affected_person_ids: [] }, error: null }));
    const id = await saveAlbumWithTracks(db as never, albumPayload(), [
      trackPayload({ number: 1, parent_id: null, cover_url: null }),
      trackPayload({ number: 2, title: "第二首", parent_id: null, runtime: 7200, cover_url: null }),
    ]);
    expect(id).toBe(albumId);
    // 专辑解析封面；曲目不调用 resolveMusicCover
    expect(resolveMusicCover).toHaveBeenCalledTimes(1);
    expect(resolveMusicCover).toHaveBeenCalledWith(expect.objectContaining({ entity: "album", title: "新专辑" }));
    expect(db.rpc).toHaveBeenCalledWith(
      "admin_save_album_with_tracks",
      expect.objectContaining({
        p_tracks: expect.arrayContaining([
          expect.objectContaining({ type: "music", number: 1, cover_url: null }),
          expect.objectContaining({ type: "music", number: 2, runtime: 7200, cover_url: null }),
        ]),
      }),
    );
    expect((db.rpc.mock.calls[0]?.[1] as { p_tracks: unknown[] }).p_tracks).toHaveLength(2);
  });

  it("曲目列表含非 music 时拒绝", async () => {
    await expect(
      saveAlbumWithTracks({ from: vi.fn(), rpc: vi.fn() } as never, albumPayload(), [
        trackPayload({ type: "album" as never }),
      ]),
    ).rejects.toThrow(/曲目列表只能包含 music/);
  });
});

describe("deleteMusicTree", () => {
  it("删除专辑经 admin_delete_media 原子处理", async () => {
    const selectMaybe = vi.fn(async () => ({
      data: { id: albumId, title: "要删的专辑", type: "album" },
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table === "media_items") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: selectMaybe,
            }),
          }),
        };
      }
      throw new Error(table);
    });
    const rpc = vi.fn(async () => ({ data: null, error: null }));

    await expect(deleteMusicTree({ from, rpc } as never, albumId, "要删的专辑")).resolves.toBe("album");
    expect(rpc).toHaveBeenCalledWith("admin_delete_media", {
      p_id: albumId,
      p_confirm_title: "要删的专辑",
    });
  });

  it("删除单曲目也经 admin_delete_media", async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: trackId, title: "单曲", type: "music" }, error: null }),
        }),
      }),
    }));
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    await expect(deleteMusicTree({ from, rpc } as never, trackId, "单曲")).resolves.toBe("music");
    expect(rpc).toHaveBeenCalledWith("admin_delete_media", {
      p_id: trackId,
      p_confirm_title: "单曲",
    });
  });

  it("标题不匹配时拒绝删除且不调 RPC", async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: trackId, title: "真标题", type: "music" }, error: null }),
        }),
      }),
    }));
    const rpc = vi.fn();
    await expect(deleteMusicTree({ from, rpc } as never, trackId, "错标题")).rejects.toThrow(/标题不匹配/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("拒绝删除非音乐类型", async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: albumId, title: "电影", type: "movie" }, error: null }),
        }),
      }),
    }));
    const rpc = vi.fn();
    await expect(deleteMusicTree({ from, rpc } as never, albumId, "电影")).rejects.toThrow(/只支持删除专辑与曲目/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("目标不存在时抛出 SaveMusicMediaError", async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }));
    await expect(deleteMusicTree({ from, rpc: vi.fn() } as never, albumId, "x")).rejects.toBeInstanceOf(
      SaveMusicMediaError,
    );
  });

  it("RPC 权限错误映射为站长提示", async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: albumId, title: "专辑", type: "album" }, error: null }),
        }),
      }),
    }));
    const rpc = vi.fn(async () => ({ data: null, error: { code: "42501" } }));
    await expect(deleteMusicTree({ from, rpc } as never, albumId, "专辑")).rejects.toThrow(/没有写入权限/);
  });
});
