import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/revalidate-media", () => ({
  affectedMediaIds: vi.fn(async (_db: unknown, ids: string[]) => ids),
  revalidateMediaItems: vi.fn(),
}));
vi.mock("@/lib/music/resolve-cover", () => ({
  resolveMusicCover: vi.fn(),
}));

import {
  applyMusicCoverRematch,
  isMzstaticCoverUrl,
  listMzstaticMusicItems,
  mapWithConcurrency,
  parseRematchApplyPayload,
  previewMusicCoverRematch,
} from "@/lib/admin/rematch-music-covers";
import { resolveMusicCover } from "@/lib/music/resolve-cover";
import { revalidateMediaItems } from "@/lib/admin/revalidate-media";

const albumId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const trackId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const mz = "https://is1-ssl.mzstatic.com/image/thumb/Music/old/600x600bb.jpg";
const mzNew = "https://is1-ssl.mzstatic.com/image/thumb/Music/new/600x600bb.jpg";
const caa = "https://coverartarchive.org/release/x/front-500";

type Result = { data?: unknown; error?: unknown };
type QueryCall = { method: string; args: unknown[] };
type Query = { table: string; calls: QueryCall[] };

function fakeDb(handle: (query: Query) => Result) {
  const from = vi.fn((table: string) => {
    const query: Query = { table, calls: [] };
    const builder: Record<string, unknown> = {
      then: (resolve: (value: Result) => void) => resolve({ data: [], error: null, ...handle(query) }),
    };
    for (const method of ["select", "order", "range", "or", "in", "eq", "delete", "upsert", "not", "ilike", "update"]) {
      builder[method] = (...args: unknown[]) => {
        query.calls.push({ method, args });
        return builder;
      };
    }
    return builder;
  });
  return { from } as unknown as SupabaseClient;
}

describe("isMzstaticCoverUrl", () => {
  it("accepts only https *.mzstatic.com hosts", () => {
    expect(isMzstaticCoverUrl(mz)).toBe(true);
    expect(isMzstaticCoverUrl(caa)).toBe(false);
    expect(isMzstaticCoverUrl("https://evil.mzstatic.com.example/x")).toBe(false);
    expect(isMzstaticCoverUrl(null)).toBe(false);
  });
});

describe("parseRematchApplyPayload", () => {
  it("keeps only valid ids and allowed cover hosts", () => {
    expect(
      parseRematchApplyPayload([
        { id: albumId, cover_url: mzNew },
        { id: "not-uuid", cover_url: mzNew },
        { id: trackId, cover_url: null },
        { id: otherId, cover_url: "https://evil.example/x.jpg" },
      ]),
    ).toEqual([
      { id: albumId, cover_url: mzNew },
      { id: trackId, cover_url: null },
    ]);
  });
});

describe("mapWithConcurrency", () => {
  it("limits parallel workers", async () => {
    let active = 0;
    let maxActive = 0;
    const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return value * 2;
    });
    expect(result).toEqual([2, 4, 6, 8, 10]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});

describe("listMzstaticMusicItems", () => {
  it("only returns album/music rows with mzstatic covers", async () => {
    const db = fakeDb((query) => {
      if (query.table === "media_items") {
        return {
          data: [
            { id: albumId, type: "album", title: "叶惠美", cover_url: mz },
            { id: trackId, type: "music", title: "晴天", cover_url: caa },
            { id: otherId, type: "movie", title: "电影", cover_url: mz },
          ],
          error: null,
        };
      }
      if (query.table === "media_credits") {
        return {
          data: [{ media_item_id: albumId, people: { name: "周杰伦" } }],
          error: null,
        };
      }
      return { data: [], error: null };
    });

    const rows = await listMzstaticMusicItems(db, { limit: 50 });
    expect(rows).toEqual([{ id: albumId, type: "album", title: "叶惠美", cover_url: mz, artist: "周杰伦" }]);
  });
});

describe("previewMusicCoverRematch", () => {
  beforeEach(() => {
    vi.mocked(resolveMusicCover).mockReset();
  });

  it("lists new covers or null clear markers without writing", async () => {
    vi.mocked(resolveMusicCover).mockResolvedValueOnce(mzNew).mockResolvedValueOnce(null);
    const rows = await previewMusicCoverRematch([
      { id: albumId, type: "album", title: "叶惠美", cover_url: mz, artist: "周杰伦" },
      { id: trackId, type: "music", title: "错图", cover_url: mz, artist: "某人" },
    ]);
    expect(rows).toEqual([
      {
        id: albumId,
        type: "album",
        title: "叶惠美",
        artist: "周杰伦",
        oldCover: mz,
        newCover: mzNew,
        willChange: true,
      },
      {
        id: trackId,
        type: "music",
        title: "错图",
        artist: "某人",
        oldCover: mz,
        newCover: null,
        willChange: true,
      },
    ]);
  });
});

describe("applyMusicCoverRematch", () => {
  beforeEach(() => {
    vi.mocked(revalidateMediaItems).mockClear();
  });

  it("updates only selected mzstatic music items", async () => {
    const updated: Array<{ id: string; cover_url: string | null }> = [];
    const db = fakeDb((query) => {
      if (query.table !== "media_items") return { data: [], error: null };
      const hasUpdate = query.calls.some((call) => call.method === "update");
      if (!hasUpdate) {
        return {
          data: [
            { id: albumId, type: "album", cover_url: mz },
            { id: trackId, type: "music", cover_url: mz },
            { id: otherId, type: "music", cover_url: caa },
          ],
          error: null,
        };
      }
      const updateCall = query.calls.find((call) => call.method === "update");
      const eqCall = query.calls.find((call) => call.method === "eq");
      const id = String(eqCall?.args[1] ?? "");
      const cover_url = (updateCall?.args[0] as { cover_url: string | null }).cover_url;
      updated.push({ id, cover_url });
      return { data: [{ id }], error: null };
    });

    const result = await applyMusicCoverRematch(db, [
      { id: albumId, cover_url: mzNew },
      { id: trackId, cover_url: null },
      { id: otherId, cover_url: mzNew },
    ]);

    expect(result).toEqual({ succeeded: 2, failed: 1, cleared: 1 });
    expect(updated).toEqual([
      { id: albumId, cover_url: mzNew },
      { id: trackId, cover_url: null },
    ]);
    expect(revalidateMediaItems).toHaveBeenCalledOnce();
  });
});
