import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  displayCoverUrl,
  fetchAlbumCoversByTrackIds,
  trackDisplayCoverUrl,
  withAlbumCoversForTracks,
} from "@/lib/music/track-display-cover";

const trackA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const trackB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const albumA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const albumB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const albumCover = "https://is1-ssl.mzstatic.com/image/thumb/Music/album/600x600bb.jpg";
const trackOwnCover = "https://coverartarchive.org/release/track/front-500";

type Result = { data?: unknown; error?: unknown };
type QueryCall = { method: string; args: unknown[] };
type Query = { table: string; calls: QueryCall[] };

function fakeDb(handle: (query: Query) => Result) {
  const from = vi.fn((table: string) => {
    const query: Query = { table, calls: [] };
    const builder: Record<string, unknown> = {
      then: (resolve: (value: Result) => void) => resolve({ data: [], error: null, ...handle(query) }),
    };
    for (const method of ["select", "in", "eq", "order", "limit"]) {
      builder[method] = (...args: unknown[]) => {
        query.calls.push({ method, args });
        return builder;
      };
    }
    return builder;
  });
  return { from } as unknown as SupabaseClient;
}

describe("trackDisplayCoverUrl / displayCoverUrl", () => {
  it("曲目自身无封面时回退专辑封面；有自身封面时保留", () => {
    expect(trackDisplayCoverUrl(albumCover)).toBe(albumCover);
    expect(trackDisplayCoverUrl("  ")).toBeNull();
    expect(trackDisplayCoverUrl(null)).toBeNull();
    expect(displayCoverUrl("music", null, albumCover)).toBe(albumCover);
    expect(displayCoverUrl("music", "", albumCover)).toBe(albumCover);
    expect(displayCoverUrl("music", trackOwnCover, albumCover)).toBe(trackOwnCover);
    expect(displayCoverUrl("music", trackOwnCover, null)).toBe(trackOwnCover);
    expect(displayCoverUrl("music", null, null)).toBeNull();
    expect(displayCoverUrl("album", albumCover, null)).toBe(albumCover);
    expect(displayCoverUrl("movie", "/poster.jpg", albumCover)).toBe("/poster.jpg");
  });
});

const olderAlbumCover = "https://example.com/older-album.jpg";
const newerAlbumCover = "https://example.com/newer-album.jpg";
const albumC = "ffffffff-ffff-4fff-8fff-ffffffffffff";

describe("fetchAlbumCoversByTrackIds", () => {
  it("批量 join album_tracks.song_id → album cover_url，避免按曲目逐条查询", async () => {
    const db = fakeDb((query) => {
      if (query.table === "album_tracks") {
        return {
          data: [
            { song_id: trackA, album_id: albumA },
            { song_id: trackB, album_id: albumB },
          ],
          error: null,
        };
      }
      if (query.table === "media_items") {
        return {
          data: [
            { id: albumA, cover_url: albumCover, release_date: "2020-01-01" },
            { id: albumB, cover_url: null, release_date: "2021-01-01" },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    });

    const map = await fetchAlbumCoversByTrackIds(db, [trackA, trackB, trackA]);
    expect(map.get(trackA)).toBe(albumCover);
    expect(map.get(trackB)).toBeNull();
    expect(db.from).toHaveBeenCalledWith("album_tracks");
    expect(db.from).toHaveBeenCalledWith("media_items");
    expect(db.from).toHaveBeenCalledTimes(2);
  });

  it("一首歌多专辑时取发行日最早且有封面的专辑，不受 album_tracks 返回次序影响", async () => {
    const db = fakeDb((query) => {
      if (query.table === "album_tracks") {
        // 故意把较新专辑放在前面
        return {
          data: [
            { song_id: trackA, album_id: albumB },
            { song_id: trackA, album_id: albumA },
          ],
          error: null,
        };
      }
      if (query.table === "media_items") {
        return {
          data: [
            { id: albumB, cover_url: newerAlbumCover, release_date: "2022-06-01" },
            { id: albumA, cover_url: olderAlbumCover, release_date: "2019-03-01" },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    });

    const map = await fetchAlbumCoversByTrackIds(db, [trackA]);
    expect(map.get(trackA)).toBe(olderAlbumCover);
  });

  it("最早专辑无封面时回退到下一张有封面的更早候选；同日按 album_id 稳定次序", async () => {
    const db = fakeDb((query) => {
      if (query.table === "album_tracks") {
        return {
          data: [
            { song_id: trackA, album_id: albumC },
            { song_id: trackA, album_id: albumB },
            { song_id: trackA, album_id: albumA },
          ],
          error: null,
        };
      }
      if (query.table === "media_items") {
        return {
          data: [
            { id: albumA, cover_url: null, release_date: "2018-01-01" },
            { id: albumB, cover_url: newerAlbumCover, release_date: "2020-01-01" },
            { id: albumC, cover_url: olderAlbumCover, release_date: "2020-01-01" },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    });

    const map = await fetchAlbumCoversByTrackIds(db, [trackA]);
    // 跳过最早无封面专辑后，同日按 album_id 升序 → albumB（dddd…）先于 albumC（ffff…）
    expect(map.get(trackA)).toBe(newerAlbumCover);
  });
});

describe("withAlbumCoversForTracks", () => {
  it("仅给无自身封面的 music 条目补专辑封面；已有封面与其它类型保留", async () => {
    const db = fakeDb((query) => {
      if (query.table === "album_tracks") {
        return {
          data: [
            { song_id: trackA, album_id: albumA },
            { song_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", album_id: albumA },
          ],
          error: null,
        };
      }
      if (query.table === "media_items") {
        return { data: [{ id: albumA, cover_url: albumCover, release_date: "2020-01-01" }], error: null };
      }
      return { data: [], error: null };
    });

    const rows = await withAlbumCoversForTracks(db, [
      { id: trackA, type: "music", cover_url: null },
      { id: albumA, type: "album", cover_url: albumCover },
      { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", dbType: "music", cover_url: trackOwnCover },
    ]);

    expect(rows[0]?.cover_url).toBe(albumCover);
    expect(rows[1]?.cover_url).toBe(albumCover);
    expect(rows[2]?.cover_url).toBe(trackOwnCover);
  });
});
