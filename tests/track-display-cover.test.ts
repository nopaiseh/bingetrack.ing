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
  it("曲目只用专辑封面，绝不回退到曲目自身封面", () => {
    expect(trackDisplayCoverUrl(albumCover)).toBe(albumCover);
    expect(trackDisplayCoverUrl("  ")).toBeNull();
    expect(trackDisplayCoverUrl(null)).toBeNull();
    expect(displayCoverUrl("music", trackOwnCover, albumCover)).toBe(albumCover);
    expect(displayCoverUrl("music", trackOwnCover, null)).toBeNull();
    expect(displayCoverUrl("music", trackOwnCover, "")).toBeNull();
    expect(displayCoverUrl("album", albumCover, null)).toBe(albumCover);
    expect(displayCoverUrl("movie", "/poster.jpg", albumCover)).toBe("/poster.jpg");
  });
});

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
            { id: albumA, cover_url: albumCover },
            { id: albumB, cover_url: null },
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
});

describe("withAlbumCoversForTracks", () => {
  it("仅替换 music 条目的 cover_url，其它类型保留原值", async () => {
    const db = fakeDb((query) => {
      if (query.table === "album_tracks") {
        return { data: [{ song_id: trackA, album_id: albumA }], error: null };
      }
      if (query.table === "media_items") {
        return { data: [{ id: albumA, cover_url: albumCover }], error: null };
      }
      return { data: [], error: null };
    });

    const rows = await withAlbumCoversForTracks(db, [
      { id: trackA, type: "music", cover_url: trackOwnCover },
      { id: albumA, type: "album", cover_url: albumCover },
      { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", dbType: "music", cover_url: trackOwnCover },
    ]);

    expect(rows[0]?.cover_url).toBe(albumCover);
    expect(rows[1]?.cover_url).toBe(albumCover);
    // 无 music 行时专辑封面映射缺失 → null，不回退自身封面
    expect(rows[2]?.cover_url).toBeNull();
  });
});
