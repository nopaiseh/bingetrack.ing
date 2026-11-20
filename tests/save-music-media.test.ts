import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteMusicTree, saveMusicMedia } from "@/lib/admin/save-music-media";
import type { MediaInput } from "@/lib/admin/media-form";

vi.mock("@/lib/music/dedupe", () => ({
  findMusicDuplicateId: vi.fn(async () => null),
}));
vi.mock("@/lib/music/resolve-cover", () => ({
  resolveMusicCover: vi.fn(async () => "https://is1-ssl.mzstatic.com/image/thumb/Music/auto.jpg"),
}));

const albumId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const trackId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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

describe("saveMusicMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("新建专辑时解析封面并写入 music_albums 与艺人", async () => {
    const mediaInsert = vi.fn(() => ({
      select: () => ({
        single: vi.fn(async () => ({ data: { id: albumId }, error: null })),
      }),
    }));
    const albumUpsert = vi.fn(async () => ({ error: null }));
    const creditsDelete = vi.fn(() => ({
      eq: () => ({ eq: vi.fn(async () => ({ error: null })) }),
    }));
    const peopleSelect = vi.fn(() => ({
      eq: () => ({
        is: () => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        }),
      }),
    }));
    const peopleInsert = vi.fn(() => ({
      select: () => ({
        single: vi.fn(async () => ({ data: { id: "person-1" }, error: null })),
      }),
    }));
    const creditsUpsert = vi.fn(async () => ({ error: null }));
    const genresUpsert = vi.fn(() => ({
      select: () => ({
        single: vi.fn(async () => ({ data: { id: "genre-1" }, error: null })),
      }),
    }));
    const genreLinkDelete = vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    }));
    const genreLinkUpsert = vi.fn(async () => ({ error: null }));
    const seriesDelete = vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    }));

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
  });

  it("新建曲目前校验所属专辑存在，并写入 tracking", async () => {
    const mediaInsert = vi.fn(() => ({
      select: () => ({
        single: vi.fn(async () => ({ data: { id: trackId }, error: null })),
      }),
    }));
    const musicUpsert = vi.fn(async () => ({ error: null }));
    const creditsDelete = vi.fn(() => ({
      eq: () => ({ eq: vi.fn(async () => ({ error: null })) }),
    }));
    const peopleSelect = vi.fn(() => ({
      eq: () => ({
        is: () => ({
          maybeSingle: vi.fn(async () => ({ data: { id: "person-1" }, error: null })),
        }),
      }),
    }));
    const creditsUpsert = vi.fn(async () => ({ error: null }));
    const trackingUpsert = vi.fn(async () => ({ error: null }));

    const from = vi.fn((table: string) => {
      if (table === "media_items") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: albumId }, error: null }),
              }),
            }),
          }),
          insert: mediaInsert,
        };
      }
      if (table === "music") return { upsert: musicUpsert };
      if (table === "media_credits") return { delete: creditsDelete, upsert: creditsUpsert };
      if (table === "people") return { select: peopleSelect };
      if (table === "tracking") return { upsert: trackingUpsert };
      throw new Error(table);
    });

    const id = await saveMusicMedia({ from } as never, trackPayload());
    expect(id).toBe(trackId);
    expect(musicUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ media_item_id: trackId, album_id: albumId, track_number: 1 }),
    );
    expect(trackingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ media_item_id: trackId, status: "watched", rating: 8 }),
      expect.anything(),
    );
  });
});

describe("deleteMusicTree", () => {
  it("删除专辑前先删下属曲目 media_items", async () => {
    const selectMaybe = vi.fn(async () => ({
      data: { id: albumId, title: "要删的专辑", type: "album" },
      error: null,
    }));
    const trackSelect = vi.fn(() => ({
      eq: vi.fn(async () => ({
        data: [{ media_item_id: trackId }],
        error: null,
      })),
    }));
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
});
