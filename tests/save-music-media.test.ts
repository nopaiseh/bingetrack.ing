import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteMusicTree, saveMusicMedia, SaveMusicMediaError } from "@/lib/admin/save-music-media";
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
const personId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

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

/** 曲目保存：专辑校验、同专辑查重、曲序占用检查。 */
function trackGuardFrom(options?: {
  albumExists?: boolean;
  siblingTracks?: { media_item_id: string; title: string; artists?: string[] }[];
  takenTrackNumber?: boolean;
}) {
  const albumExists = options?.albumExists ?? true;
  const siblings = options?.siblingTracks ?? [];
  const taken = options?.takenTrackNumber ?? false;

  return (table: string) => {
    if (table === "media_items") {
      return {
        select: () => chainResult({ data: albumExists ? { id: albumId } : null, error: null }),
      };
    }
    if (table === "music") {
      return {
        select: (columns: string) => {
          if (columns.includes("title")) {
            return chainResult({
              data: siblings.map((row) => ({
                media_item_id: row.media_item_id,
                media: { id: row.media_item_id, title: row.title },
              })),
              error: null,
            });
          }
          return chainResult({
            data: taken ? [{ media_item_id: otherTrack }] : [],
            error: null,
          });
        },
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

describe("saveMusicMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findMusicDuplicateId).mockResolvedValue(null);
    vi.mocked(resolveMusicCover).mockResolvedValue("https://is1-ssl.mzstatic.com/image/thumb/Music/auto.jpg");
  });

  it("拒绝非专辑／曲目类型", async () => {
    await expect(saveMusicMedia({ from: vi.fn() } as never, albumPayload({ type: "movie" }))).rejects.toThrow(
      /只支持专辑与曲目/,
    );
  });

  it("新建专辑时解析封面并写入 music_albums 与艺人", async () => {
    const mediaInsert = vi.fn(() => chainResult({ data: { id: albumId }, error: null }));
    const albumUpsert = vi.fn(async () => ({ error: null }));
    const creditsDelete = vi.fn(() => chainResult({ error: null }));
    const peopleSelect = vi.fn(() => chainResult({ data: null, error: null }));
    const peopleInsert = vi.fn(() => chainResult({ data: { id: "person-1" }, error: null }));
    const creditsUpsert = vi.fn(async () => ({ error: null }));
    const genresUpsert = vi.fn(() => chainResult({ data: { id: "genre-1" }, error: null }));
    const genreLinkDelete = vi.fn(() => chainResult({ error: null }));
    const genreLinkUpsert = vi.fn(async () => ({ error: null }));
    const seriesDelete = vi.fn(() => chainResult({ error: null }));

    let peopleCalls = 0;
    const from = vi.fn((table: string) => {
      if (table === "media_items") return { insert: mediaInsert };
      if (table === "music_albums") return { upsert: albumUpsert };
      if (table === "media_credits") return { delete: creditsDelete, upsert: creditsUpsert };
      if (table === "people") {
        peopleCalls += 1;
        return peopleCalls === 1 ? { select: peopleSelect } : { insert: peopleInsert };
      }
      if (table === "genres") return { upsert: genresUpsert };
      if (table === "media_genres") return { delete: genreLinkDelete, upsert: genreLinkUpsert };
      if (table === "media_item_series") return { delete: seriesDelete };
      throw new Error(table);
    });

    const id = await saveMusicMedia({ from } as never, albumPayload());
    expect(id).toBe(albumId);
    expect(mediaInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "album",
        title: "新专辑",
        cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music/auto.jpg",
      }),
    );
    expect(albumUpsert).toHaveBeenCalledWith(expect.objectContaining({ media_item_id: albumId, label: "厂牌" }));
    expect(findMusicDuplicateId).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "album", title: "新专辑" }),
    );
  });

  it("更新已有专辑：按人物 ID 解析，写入合集", async () => {
    const mediaUpdate = vi.fn(() => chainResult({ error: null }));
    const albumUpsert = vi.fn(async () => ({ error: null }));
    const creditsDelete = vi.fn(() => chainResult({ error: null }));
    const creditsUpsert = vi.fn(async () => ({ error: null }));
    const peopleById = vi.fn(() => chainResult({ data: { id: personId }, error: null }));
    const seriesUpsert = vi.fn(() => chainResult({ data: { id: "series-1" }, error: null }));
    const seriesMax = vi.fn(() => chainResult({ data: { position: 2 }, error: null }));
    const seriesLinkUpsert = vi.fn(() => chainResult({ error: null }));
    const seriesDelete = vi.fn(() => chainResult({ error: null }));
    const genreDelete = vi.fn(() => chainResult({ error: null }));

    let seriesSelectCalls = 0;
    const from = vi.fn((table: string) => {
      if (table === "media_items") {
        return {
          select: () => chainResult({ data: { type: "album" }, error: null }),
          update: mediaUpdate,
        };
      }
      if (table === "music_albums") return { upsert: albumUpsert };
      if (table === "media_credits") return { delete: creditsDelete, upsert: creditsUpsert };
      if (table === "people") return { select: peopleById };
      if (table === "media_genres") return { delete: genreDelete };
      if (table === "media_series") return { upsert: seriesUpsert };
      if (table === "media_item_series") {
        seriesSelectCalls += 1;
        if (seriesSelectCalls === 1) return { select: seriesMax, upsert: seriesLinkUpsert, delete: seriesDelete };
        return { delete: seriesDelete, upsert: seriesLinkUpsert };
      }
      throw new Error(table);
    });

    const id = await saveMusicMedia(
      { from } as never,
      albumPayload({
        id: albumId,
        cover_url: "https://coverartarchive.org/release/x/front-500",
        artists: [{ id: personId, name: "艺人" }],
        genres: [],
        collections: ["精选"],
      }),
    );
    expect(id).toBe(albumId);
    expect(mediaUpdate).toHaveBeenCalled();
    expect(resolveMusicCover).not.toHaveBeenCalled();
    expect(seriesUpsert).toHaveBeenCalled();
  });

  it("新建曲目前校验所属专辑存在，并写入 tracking", async () => {
    const mediaInsert = vi.fn(() => chainResult({ data: { id: trackId }, error: null }));
    const musicUpsert = vi.fn(async () => ({ error: null }));
    const creditsDelete = vi.fn(() => chainResult({ error: null }));
    const peopleSelect = vi.fn(() => chainResult({ data: { id: "person-1" }, error: null }));
    const creditsUpsert = vi.fn(async () => ({ error: null }));
    const trackingUpsert = vi.fn(async () => ({ error: null }));
    let mediaItemsSelects = 0;
    let musicSelects = 0;

    const from = vi.fn((table: string) => {
      if (table === "media_items") {
        return {
          select: () => {
            mediaItemsSelects += 1;
            return chainResult({ data: { id: albumId }, error: null });
          },
          insert: mediaInsert,
        };
      }
      if (table === "music") {
        return {
          select: () => {
            musicSelects += 1;
            // 1) 同专辑查重 2) 曲序占用
            return chainResult({ data: [], error: null });
          },
          upsert: musicUpsert,
        };
      }
      if (table === "media_credits") {
        return {
          select: () => chainResult({ data: [], error: null }),
          delete: creditsDelete,
          upsert: creditsUpsert,
        };
      }
      if (table === "people") return { select: peopleSelect };
      if (table === "tracking") return { upsert: trackingUpsert };
      throw new Error(table);
    });

    const id = await saveMusicMedia({ from } as never, trackPayload());
    expect(id).toBe(trackId);
    expect(mediaItemsSelects).toBeGreaterThanOrEqual(1);
    expect(musicSelects).toBeGreaterThanOrEqual(2);
    expect(findMusicDuplicateId).not.toHaveBeenCalled();
    expect(musicUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ media_item_id: trackId, album_id: albumId, track_number: 1 }),
    );
    expect(trackingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ media_item_id: trackId, status: "watched", rating: 8 }),
      expect.anything(),
    );
  });

  it("所属专辑不存在时拒绝保存曲目", async () => {
    const from = vi.fn(trackGuardFrom({ albumExists: false }));
    await expect(saveMusicMedia({ from } as never, trackPayload())).rejects.toThrow(/所属专辑不存在/);
  });

  it("专辑全库查重命中时拒绝", async () => {
    vi.mocked(findMusicDuplicateId).mockResolvedValue("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    await expect(saveMusicMedia({ from: vi.fn() } as never, albumPayload())).rejects.toThrow(/已存在同名同艺人的专辑/);
  });

  it("同一专辑内同名同歌手曲目拒绝，不同专辑同名同歌手可保存", async () => {
    const blocked = vi.fn(
      trackGuardFrom({
        siblingTracks: [{ media_item_id: otherTrack, title: "新曲目", artists: ["主唱"] }],
      }),
    );
    await expect(saveMusicMedia({ from: blocked } as never, trackPayload())).rejects.toThrow(/已存在同名同艺人的曲目/);

    const mediaInsert = vi.fn(() => chainResult({ data: { id: trackId }, error: null }));
    const musicUpsert = vi.fn(async () => ({ error: null }));
    const creditsDelete = vi.fn(() => chainResult({ error: null }));
    const peopleSelect = vi.fn(() => chainResult({ data: { id: "person-1" }, error: null }));
    const creditsUpsert = vi.fn(async () => ({ error: null }));
    const trackingUpsert = vi.fn(async () => ({ error: null }));

    const from = vi.fn((table: string) => {
      if (table === "media_items") {
        return {
          select: () => chainResult({ data: { id: albumB }, error: null }),
          insert: mediaInsert,
        };
      }
      if (table === "music") {
        return {
          // 另一专辑下无同名条目／曲序空闲
          select: () => chainResult({ data: [], error: null }),
          upsert: musicUpsert,
        };
      }
      if (table === "media_credits") {
        return {
          select: () => chainResult({ data: [], error: null }),
          delete: creditsDelete,
          upsert: creditsUpsert,
        };
      }
      if (table === "people") return { select: peopleSelect };
      if (table === "tracking") return { upsert: trackingUpsert };
      throw new Error(table);
    });

    await expect(saveMusicMedia({ from } as never, trackPayload({ parent_id: albumB }))).resolves.toBe(trackId);
    expect(findMusicDuplicateId).not.toHaveBeenCalled();
  });

  it("保存前发现同专辑曲序已被占用时拒绝（不依赖库唯一约束）", async () => {
    const mediaInsert = vi.fn(() => chainResult({ data: { id: trackId }, error: null }));
    const mediaDelete = vi.fn(() => chainResult({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "media_items") {
        return {
          select: () => chainResult({ data: { id: albumId }, error: null }),
          insert: mediaInsert,
          delete: mediaDelete,
        };
      }
      return trackGuardFrom({ takenTrackNumber: true })(table);
    });
    await expect(saveMusicMedia({ from } as never, trackPayload())).rejects.toThrow(/曲序已存在/);
    expect(mediaInsert).toHaveBeenCalled();
    expect(mediaDelete).toHaveBeenCalled();
  });

  it("replaceCredits 先解析人物再删旧写新", async () => {
    const order: string[] = [];
    const peopleSelect = vi.fn(() => {
      order.push("resolve");
      return chainResult({ data: { id: personId }, error: null });
    });
    const creditsDelete = vi.fn(() => {
      order.push("delete");
      return chainResult({ error: null });
    });
    const creditsUpsert = vi.fn(async () => {
      order.push("upsert");
      return { error: null };
    });
    const mediaUpdate = vi.fn(() => chainResult({ error: null }));
    const albumUpsert = vi.fn(async () => ({ error: null }));
    const genreDelete = vi.fn(() => chainResult({ error: null }));
    const seriesDelete = vi.fn(() => chainResult({ error: null }));

    const from = vi.fn((table: string) => {
      if (table === "media_items") {
        return {
          select: () => chainResult({ data: { type: "album" }, error: null }),
          update: mediaUpdate,
        };
      }
      if (table === "music_albums") return { upsert: albumUpsert };
      if (table === "people") return { select: peopleSelect };
      if (table === "media_credits") return { delete: creditsDelete, upsert: creditsUpsert };
      if (table === "media_genres") return { delete: genreDelete };
      if (table === "media_item_series") return { delete: seriesDelete };
      throw new Error(table);
    });

    await saveMusicMedia(
      { from } as never,
      albumPayload({
        id: albumId,
        cover_url: "https://coverartarchive.org/release/x/front-500",
        artists: [{ id: personId, name: "艺人" }],
        genres: [],
      }),
    );
    expect(order).toEqual(["resolve", "delete", "upsert"]);
  });

  it("replaceNamedLinks 先解析类型 ID 再删旧关联", async () => {
    const order: string[] = [];
    const genresUpsert = vi.fn(() => {
      order.push("genre");
      return chainResult({ data: { id: "genre-1" }, error: null });
    });
    const genreLinkDelete = vi.fn(() => {
      order.push("delete");
      return chainResult({ error: null });
    });
    const genreLinkUpsert = vi.fn(async () => {
      order.push("link");
      return { error: null };
    });
    const mediaUpdate = vi.fn(() => chainResult({ error: null }));
    const albumUpsert = vi.fn(async () => ({ error: null }));
    const creditsDelete = vi.fn(() => chainResult({ error: null }));
    const seriesDelete = vi.fn(() => chainResult({ error: null }));

    const from = vi.fn((table: string) => {
      if (table === "media_items") {
        return {
          select: () => chainResult({ data: { type: "album" }, error: null }),
          update: mediaUpdate,
        };
      }
      if (table === "music_albums") return { upsert: albumUpsert };
      if (table === "media_credits") return { delete: creditsDelete, upsert: async () => ({ error: null }) };
      if (table === "genres") return { upsert: genresUpsert };
      if (table === "media_genres") return { delete: genreLinkDelete, upsert: genreLinkUpsert };
      if (table === "media_item_series") return { delete: seriesDelete };
      throw new Error(table);
    });

    await saveMusicMedia(
      { from } as never,
      albumPayload({
        id: albumId,
        cover_url: "https://coverartarchive.org/release/x/front-500",
        artists: [],
        genres: ["流行"],
      }),
    );
    expect(order).toEqual(["genre", "delete", "link"]);
  });

  it("新建后后续失败会删除刚插入的 media_items 并抛出原错误", async () => {
    const mediaInsert = vi.fn(() => chainResult({ data: { id: albumId }, error: null }));
    const mediaDelete = vi.fn(() => chainResult({ error: null }));
    const albumUpsert = vi.fn(async () => ({ error: { code: "42501" } }));

    const from = vi.fn((table: string) => {
      if (table === "media_items") return { insert: mediaInsert, delete: mediaDelete };
      if (table === "music_albums") return { upsert: albumUpsert };
      throw new Error(table);
    });

    await expect(saveMusicMedia({ from } as never, albumPayload({ artists: [], genres: [] }))).rejects.toThrow(
      /没有写入权限/,
    );
    expect(mediaDelete).toHaveBeenCalled();
    const deleteBuilder = mediaDelete.mock.results[0]?.value as { eq?: unknown };
    expect(typeof deleteBuilder?.eq === "function" || mediaDelete).toBeTruthy();
  });

  it("不能把已有条目改成另一媒体类型", async () => {
    const from = vi.fn(() => ({
      select: () => chainResult({ data: { type: "movie" }, error: null }),
    }));
    await expect(saveMusicMedia({ from } as never, albumPayload({ id: albumId }))).rejects.toThrow(/不能更改媒体类型/);
  });

  it("更新不存在的条目时返回友好错误", async () => {
    const from = vi.fn(() => ({
      select: () => chainResult({ data: null, error: null }),
    }));
    await expect(saveMusicMedia({ from } as never, albumPayload({ id: albumId }))).rejects.toThrow(/资料已不存在/);
  });

  it("权限不足映射为站长权限文案", async () => {
    const from = vi.fn(() => ({
      insert: () => chainResult({ data: null, error: { code: "42501" } }),
    }));
    await expect(saveMusicMedia({ from } as never, albumPayload({ genres: [], artists: [] }))).rejects.toThrow(
      /没有写入权限/,
    );
  });
});

describe("deleteMusicTree", () => {
  it("删除专辑前先删下属曲目 media_items", async () => {
    const selectMaybe = vi.fn(async () => ({
      data: { id: albumId, title: "要删的专辑", type: "album" },
      error: null,
    }));
    const trackSelect = vi.fn(() => chainResult({ data: [{ media_item_id: trackId }], error: null }));
    const deleteIn = vi.fn(async () => ({ error: null }));
    const deleteEq = vi.fn(async () => ({ error: null }));

    const from = vi.fn((table: string) => {
      if (table === "media_items") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: selectMaybe,
            }),
          }),
          delete: () => ({
            in: deleteIn,
            eq: deleteEq,
          }),
        };
      }
      if (table === "music") return { select: trackSelect };
      throw new Error(table);
    });

    await expect(deleteMusicTree({ from } as never, albumId, "要删的专辑")).resolves.toBe("album");
    expect(deleteIn).toHaveBeenCalledWith("id", [trackId]);
    expect(deleteEq).toHaveBeenCalledWith("id", albumId);
  });

  it("删除单曲目只删自身", async () => {
    const deleteEq = vi.fn(async () => ({ error: null }));
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: trackId, title: "单曲", type: "music" }, error: null }),
        }),
      }),
      delete: () => ({ eq: deleteEq }),
    }));
    await expect(deleteMusicTree({ from } as never, trackId, "单曲")).resolves.toBe("music");
    expect(deleteEq).toHaveBeenCalledWith("id", trackId);
  });

  it("标题不匹配时拒绝删除", async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: trackId, title: "真标题", type: "music" }, error: null }),
        }),
      }),
    }));
    await expect(deleteMusicTree({ from } as never, trackId, "错标题")).rejects.toThrow(/标题不匹配/);
  });

  it("拒绝删除非音乐类型", async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: albumId, title: "电影", type: "movie" }, error: null }),
        }),
      }),
    }));
    await expect(deleteMusicTree({ from } as never, albumId, "电影")).rejects.toThrow(/只支持删除专辑与曲目/);
  });

  it("目标不存在时抛出 SaveMusicMediaError", async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }));
    await expect(deleteMusicTree({ from } as never, albumId, "x")).rejects.toBeInstanceOf(SaveMusicMediaError);
  });
});
