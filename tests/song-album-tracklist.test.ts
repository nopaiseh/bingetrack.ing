import { describe, expect, it } from "vitest";
import { buildAlbumPanelTracks, formatAlbumTrackNumber, trackSortKey } from "@/lib/song/album-tracklist";
import type { SongAlbumMembership } from "@/lib/types/song";

const currentId = "50000000-0000-4000-8000-000000000021";
const otherA = "50000000-0000-4000-8000-000000000022";
const otherB = "50000000-0000-4000-8000-000000000023";

function album(overrides: Partial<SongAlbumMembership> = {}): SongAlbumMembership {
  return {
    id: "50000000-0000-4000-8000-000000000020",
    title: "测试专辑",
    cover_url: null,
    release_date: "2024-05-20",
    release_kind: "album",
    disc_number: 1,
    track_number: 2,
    other_tracks: [
      { id: otherA, title: "曲目甲", disc_number: 1, track_number: 1, duration_seconds: 180 },
      { id: otherB, title: "曲目丙", disc_number: 1, track_number: 3, duration_seconds: 200 },
    ],
    ...overrides,
  };
}

describe("buildAlbumPanelTracks", () => {
  it("将当前曲按曲序插入 other_tracks", () => {
    const tracks = buildAlbumPanelTracks(album(), {
      id: currentId,
      title: "曲目乙",
      duration_seconds: 210,
    });
    expect(tracks.map((t) => ({ id: t.id, n: t.track_number, current: t.isCurrent }))).toEqual([
      { id: otherA, n: 1, current: false },
      { id: currentId, n: 2, current: true },
      { id: otherB, n: 3, current: false },
    ]);
  });

  it("按碟号再曲序排序", () => {
    const tracks = buildAlbumPanelTracks(
      album({
        disc_number: 2,
        track_number: 1,
        other_tracks: [
          { id: otherB, title: "二碟", disc_number: 2, track_number: 2, duration_seconds: 100 },
          { id: otherA, title: "一碟", disc_number: 1, track_number: 9, duration_seconds: 100 },
        ],
      }),
      { id: currentId, title: "当前", duration_seconds: 120 },
    );
    expect(tracks.map((t) => t.id)).toEqual([otherA, currentId, otherB]);
  });

  it("当前曲号超出 other_tracks 范围时按序追加到末尾", () => {
    const tracks = buildAlbumPanelTracks(
      album({
        track_number: 25,
        other_tracks: Array.from({ length: 3 }, (_, i) => ({
          id: `50000000-0000-4000-8000-00000000003${i}`,
          title: `前段 ${i + 1}`,
          disc_number: 1,
          track_number: i + 1,
          duration_seconds: 100,
        })),
      }),
      { id: currentId, title: "靠后曲", duration_seconds: 90 },
    );
    expect(tracks.at(-1)).toMatchObject({ id: currentId, track_number: 25, isCurrent: true });
    expect(tracks).toHaveLength(4);
  });

  it("other_tracks 已含当前曲时只标记 isCurrent，不重复", () => {
    const tracks = buildAlbumPanelTracks(
      album({
        track_number: 1,
        other_tracks: [
          { id: currentId, title: "曲目乙", disc_number: 1, track_number: 2, duration_seconds: 210 },
          { id: otherA, title: "曲目甲", disc_number: 1, track_number: 1, duration_seconds: 180 },
        ],
      }),
      { id: currentId, title: "曲目乙", duration_seconds: 210 },
    );
    expect(tracks.filter((t) => t.id === currentId)).toHaveLength(1);
    expect(tracks.find((t) => t.id === currentId)?.isCurrent).toBe(true);
  });
});

describe("formatAlbumTrackNumber / trackSortKey", () => {
  it("多碟显示碟-曲，单碟只显示曲序", () => {
    expect(formatAlbumTrackNumber({ disc_number: 2, track_number: 5 })).toBe("2-5");
    expect(formatAlbumTrackNumber({ disc_number: 1, track_number: 5 })).toBe("5");
    expect(formatAlbumTrackNumber({ disc_number: null, track_number: 5 })).toBe("5");
    expect(formatAlbumTrackNumber({ disc_number: 1, track_number: null })).toBe("—");
  });

  it("缺失碟号／曲序的排序键靠后", () => {
    expect(trackSortKey({ disc_number: null, track_number: null })[0]).toBe(Number.POSITIVE_INFINITY);
  });
});
