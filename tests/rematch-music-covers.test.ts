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
  mapWithConcurrencyUntilDeadline,
  parseRematchApplyPayload,
  previewMusicCoverRematch,
  rowsWithNewCover,
} from "@/lib/admin/rematch-music-covers";
import { resolveMusicCover } from "@/lib/music/resolve-cover";
import { revalidateMediaItems } from "@/lib/admin/revalidate-media";

const albumId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const trackId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const fourthId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const mz = "https://is1-ssl.mzstatic.com/image/thumb/Music/old/600x600bb.jpg";
const mzNew = "https://is1-ssl.mzstatic.com/image/thumb/Music/new/600x600bb.jpg";
const mzOther = "https://is1-ssl.mzstatic.com/image/thumb/Music/other/600x600bb.jpg";
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
    for (const method of [
      "select",
      "order",
      "range",
      "or",
      "in",
      "eq",
      "gt",
      "limit",
      "delete",
      "upsert",
      "not",
      "ilike",
      "update",
    ]) {
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
  it("requires expected_cover_url and keeps only valid hosts", () => {
    expect(
      parseRematchApplyPayload([
        { id: albumId, cover_url: mzNew, expected_cover_url: mz },
        { id: "not-uuid", cover_url: mzNew, expected_cover_url: mz },
        { id: trackId, cover_url: null, expected_cover_url: mz },
        { id: otherId, cover_url: mzNew },
        { id: fourthId, cover_url: "https://evil.example/x.jpg", expected_cover_url: mz },
      ]),
    ).toEqual([
      { id: albumId, cover_url: mzNew, expected_cover_url: mz },
      { id: trackId, cover_url: null, expected_cover_url: mz },
    ]);
  });
});

describe("rowsWithNewCover", () => {
  it("excludes clear-only and skipped rows for default multi-select helper", () => {
    expect(
      rowsWithNewCover([
        {
          id: albumId,
          type: "album",
          title: "a",
          artist: null,
          oldCover: mz,
          newCover: mzNew,
          willChange: true,
          skipped: false,
        },
        {
          id: trackId,
          type: "music",
          title: "b",
          artist: null,
          oldCover: mz,
          newCover: null,
          willChange: true,
          skipped: false,
        },
        {
          id: otherId,
          type: "music",
          title: "c",
          artist: null,
          oldCover: mz,
          newCover: mzNew,
          willChange: true,
          skipped: true,
        },
      ]).map((row) => row.id),
    ).toEqual([albumId]);
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

describe("mapWithConcurrencyUntilDeadline", () => {
  it("skips remaining items after the deadline", async () => {
    let now = 0;
    const { results, firstSkippedIndex } = await mapWithConcurrencyUntilDeadline(
      ["a", "b", "c", "d"],
      1,
      5,
      async (value) => {
        now += 10;
        return value.toUpperCase();
      },
      () => now,
    );
    expect(firstSkippedIndex).toBe(1);
    expect(results[0]).toBe("A");
    expect(results.slice(1).every((value) => value === undefined)).toBe(true);
  });
});

describe("listMzstaticMusicItems", () => {
  it("only returns album/music rows with mzstatic covers and supports afterId cursor", async () => {
    const db = fakeDb((query) => {
      if (query.table === "media_credits") {
        return {
          data: [{ media_item_id: trackId, people: { name: "周杰伦" } }],
          error: null,
        };
      }
      if (query.table !== "media_items") return { data: [], error: null };
      const gt = query.calls.find((call) => call.method === "gt");
      const after = gt ? String(gt.args[1]) : null;
      const all = [
        { id: albumId, type: "album", title: "叶惠美", cover_url: mz },
        { id: trackId, type: "music", title: "晴天", cover_url: mz },
        { id: otherId, type: "music", title: "错", cover_url: caa },
        { id: fourthId, type: "album", title: "下一张", cover_url: mzOther },
      ];
      const filtered = after ? all.filter((row) => row.id > after) : all;
      const limitCall = query.calls.find((call) => call.method === "limit");
      const limit = Number(limitCall?.args[0] ?? 20);
      return { data: filtered.slice(0, limit), error: null };
    });

    const first = await listMzstaticMusicItems(db, { limit: 1 });
    expect(first.items.map((row) => row.id)).toEqual([albumId]);
    expect(first.nextCursor).toBe(albumId);
    expect(first.hasMore).toBe(true);

    const second = await listMzstaticMusicItems(db, { limit: 2, afterId: albumId });
    expect(second.items.map((row) => row.id)).toEqual([trackId, fourthId]);
    expect(second.items[0]?.artist).toBe("周杰伦");
    expect(second.hasMore).toBe(false);
  });
});

describe("previewMusicCoverRematch", () => {
  beforeEach(() => {
    vi.mocked(resolveMusicCover).mockReset();
  });

  it("lists new covers or null clear markers without writing", async () => {
    vi.mocked(resolveMusicCover).mockResolvedValueOnce(mzNew).mockResolvedValueOnce(null);
    const result = await previewMusicCoverRematch([
      { id: albumId, type: "album", title: "叶惠美", cover_url: mz, artist: "周杰伦" },
      { id: trackId, type: "music", title: "错图", cover_url: mz, artist: "某人" },
    ]);
    expect(result.skipped).toBe(0);
    expect(result.rows).toEqual([
      {
        id: albumId,
        type: "album",
        title: "叶惠美",
        artist: "周杰伦",
        oldCover: mz,
        newCover: mzNew,
        willChange: true,
        skipped: false,
      },
      {
        id: trackId,
        type: "music",
        title: "错图",
        artist: "某人",
        oldCover: mz,
        newCover: null,
        willChange: true,
        skipped: false,
      },
    ]);
  });

  it("marks unresolved rows as skipped when the batch deadline is hit", async () => {
    let now = 0;
    vi.mocked(resolveMusicCover).mockImplementation(async () => {
      now += 20;
      return mzNew;
    });
    const result = await previewMusicCoverRematch(
      [
        { id: albumId, type: "album", title: "一", cover_url: mz, artist: null },
        { id: trackId, type: "music", title: "二", cover_url: mz, artist: null },
        { id: otherId, type: "music", title: "三", cover_url: mz, artist: null },
      ],
      { deadlineAt: 15, now: () => now },
    );
    expect(result.rows[0]?.skipped).toBe(false);
    expect(result.rows.slice(1).every((row) => row.skipped)).toBe(true);
    expect(result.skipped).toBe(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe(albumId);
  });
});

describe("applyMusicCoverRematch", () => {
  beforeEach(() => {
    vi.mocked(revalidateMediaItems).mockClear();
  });

  it("updates only selected mzstatic music items", async () => {
    const updated: Array<{ id: string; cover_url: string | null; expected?: string }> = [];
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
      const eqCalls = query.calls.filter((call) => call.method === "eq");
      const id = String(eqCalls.find((call) => call.args[0] === "id")?.args[1] ?? "");
      const expected = String(eqCalls.find((call) => call.args[0] === "cover_url")?.args[1] ?? "");
      const cover_url = (updateCall?.args[0] as { cover_url: string | null }).cover_url;
      updated.push({ id, cover_url, expected });
      return { data: [{ id }], error: null };
    });

    const result = await applyMusicCoverRematch(db, [
      { id: albumId, cover_url: mzNew, expected_cover_url: mz },
      { id: trackId, cover_url: null, expected_cover_url: mz },
      { id: otherId, cover_url: mzNew, expected_cover_url: mz },
    ]);

    expect(result).toMatchObject({ succeeded: 2, failed: 1, cleared: 1, conflicted: 0 });
    expect(result.succeededIds).toEqual([albumId, trackId]);
    expect(updated).toEqual([
      { id: albumId, cover_url: mzNew, expected: mz },
      { id: trackId, cover_url: null, expected: mz },
    ]);
    expect(revalidateMediaItems).toHaveBeenCalledOnce();
  });

  it("skips rows when the current cover_url no longer matches the preview old value", async () => {
    const db = fakeDb((query) => {
      if (query.table !== "media_items") return { data: [], error: null };
      const hasUpdate = query.calls.some((call) => call.method === "update");
      if (!hasUpdate) {
        return {
          data: [
            { id: albumId, type: "album", cover_url: mzOther },
            { id: trackId, type: "music", cover_url: mz },
          ],
          error: null,
        };
      }
      const eqCalls = query.calls.filter((call) => call.method === "eq");
      const id = String(eqCalls.find((call) => call.args[0] === "id")?.args[1] ?? "");
      return { data: [{ id }], error: null };
    });

    const result = await applyMusicCoverRematch(db, [
      { id: albumId, cover_url: mzNew, expected_cover_url: mz },
      { id: trackId, cover_url: mzNew, expected_cover_url: mz },
    ]);

    expect(result.succeeded).toBe(1);
    expect(result.conflicted).toBe(1);
    expect(result.conflictIds).toEqual([albumId]);
    expect(result.succeededIds).toEqual([trackId]);
  });
});
