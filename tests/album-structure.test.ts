import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAlbumStructure } from "@/lib/admin/album-structure";

type Result = { data?: unknown; error?: unknown; count?: number | null };
type QueryCall = { method: string; args: unknown[] };
type Query = { table: string; calls: QueryCall[] };

function fakeDb(handle: (query: Query) => Result) {
  const queries: Query[] = [];
  const from = vi.fn((table: string) => {
    const query: Query = { table, calls: [] };
    queries.push(query);
    const builder: Record<string, unknown> = {};
    const chain =
      (method: string) =>
      (...args: unknown[]) => {
        query.calls.push({ method, args });
        return builder;
      };
    for (const method of ["select", "eq", "gt", "lt", "order", "limit", "range"]) builder[method] = chain(method);
    const finish = () => ({ data: null, error: null, count: null, ...handle(query) });
    builder.maybeSingle = () => Promise.resolve(finish());
    builder.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(finish()).then(resolve, reject);
    return builder;
  });
  return { db: { from } as unknown as SupabaseClient, queries, from };
}

describe("readAlbumStructure", () => {
  it("电影返回 null", async () => {
    const { db, from } = fakeDb(() => ({ data: null }));
    expect(await readAlbumStructure(db, { id: "1", type: "movie", parent_id: null })).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("读取专辑曲目并计算下一曲序", async () => {
    const albumId = "11111111-1111-4111-8111-111111111111";
    const trackId = "22222222-2222-4222-8222-222222222222";
    const { db } = fakeDb((query) => {
      if (query.table === "media_items")
        return {
          data: { id: albumId, title: "叶惠美", alternate_title: "Ye Hui Mei", cover_url: null },
        };
      if (query.table === "v_all_media") return { data: { status: "watching", rating: 8.5 } };
      if (query.table === "music")
        return {
          data: [
            {
              media_item_id: trackId,
              track_number: 3,
              media: { title: "晴天", runtime: 269, tracking: { status: "watched" } },
            },
          ],
        };
      return { data: null };
    });
    const structure = await readAlbumStructure(db, { id: albumId, type: "album", parent_id: null });
    expect(structure).toMatchObject({
      album: { id: albumId, title: "叶惠美", coverUrl: null, status: "watching", rating: 8.5 },
      nextTrackNumber: 4,
      tracks: [{ id: trackId, number: 3, title: "晴天", durationSeconds: 269, listened: true }],
    });
  });

  it("曲目条目经 parent_id 解析专辑", async () => {
    const albumId = "11111111-1111-4111-8111-111111111111";
    const trackId = "22222222-2222-4222-8222-222222222222";
    const { db } = fakeDb((query) => {
      if (query.table === "media_items")
        return { data: { id: albumId, title: "叶惠美", alternate_title: null, cover_url: null } };
      if (query.table === "v_all_media") return { data: { status: "want_to_watch", rating: null } };
      if (query.table === "music") return { data: [] };
      return { data: null };
    });
    const structure = await readAlbumStructure(db, { id: trackId, type: "music", parent_id: albumId });
    expect(structure?.album.id).toBe(albumId);
    expect(structure?.tracks).toEqual([]);
    expect(structure?.nextTrackNumber).toBe(1);
  });
});
