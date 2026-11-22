import { describe, expect, it, vi } from "vitest";
import { readEditableMedia } from "@/lib/admin/read-media";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

describe("readEditableMedia", () => {
  it("处理空关联、null 引用及异常数据时不崩溃", async () => {
    const mockDb = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (table === "media_items") {
                return {
                  data: {
                    id: "11111111-1111-4111-8111-111111111111",
                    type: "movie",
                    title: "Test Movie",
                    alternate_title: null,
                    summary: null,
                    cover_url: null,
                    release_date: null,
                    runtime: 100,
                  },
                  error: null,
                };
              }
              return { data: null, error: null };
            }),
            order: vi.fn(async () => {
              if (table === "media_credits") {
                return {
                  data: [
                    {
                      role: "actor",
                      character_name: "Hero",
                      people: { id: "a1", name: "Actor A", alternate_name: "AA" },
                    },
                    { role: "actor", character_name: null, people: { id: "a3", name: "Actor C" } },
                    { role: "actor", people: null },
                    null,
                    { role: "director", people: { id: "d1", name: "Director B", alternate_name: null } },
                  ],
                  error: null,
                };
              }
              return { data: [], error: null };
            }),
            then: (resolve: (val: unknown) => void) => {
              if (table === "media_genres") {
                resolve({
                  data: [{ genres: { name: "Action" } }, { genres: null }],
                  error: null,
                });
              } else if (table === "media_item_series") {
                resolve({
                  data: null,
                  error: null,
                });
              } else {
                resolve({ data: [], error: null });
              }
            },
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    const result = await readEditableMedia(mockDb, "11111111-1111-4111-8111-111111111111");
    expect(result).not.toBeNull();
    expect(result?.title).toBe("Test Movie");
    expect(result?.genres).toEqual(["Action"]);
    expect(result?.collections).toEqual([]);
    expect(result?.actors).toEqual([
      { id: "a1", name: "Actor A", alternate_name: "AA", character: "Hero" },
      { id: "a3", name: "Actor C", alternate_name: null, character: null },
    ]);
    expect(result?.directors).toEqual([{ id: "d1", name: "Director B", alternate_name: null }]);
  });

  it("读取电视节目时从 v_all_media 动态读取观看状态与评分", async () => {
    const mockDb = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (table === "media_items") {
                return {
                  data: {
                    id: "22222222-2222-4222-8222-222222222222",
                    type: "tv_show",
                    title: "Test Series",
                  },
                  error: null,
                };
              }
              if (table === "v_all_media") {
                return {
                  data: { status: "watching", rating: 8.8 },
                  error: null,
                };
              }
              return { data: null, error: null };
            }),
            order: vi.fn(async () => ({ data: [], error: null })),
            then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    const result = await readEditableMedia(mockDb, "22222222-2222-4222-8222-222222222222");
    expect(result).not.toBeNull();
    expect(result?.status).toBe("watching");
    expect(result?.rating).toBe(8.8);
  });

  it("读取曲目时返回所属专辑、曲序与当前类型以便表单预填", async () => {
    const trackId = "44444444-4444-4444-8444-444444444444";
    const albumId = "55555555-5555-4555-8555-555555555555";
    const mockDb = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (table === "media_items") {
                return {
                  data: {
                    id: trackId,
                    type: "music",
                    title: "测试曲目",
                    alternate_title: null,
                    summary: null,
                    cover_url: null,
                    release_date: null,
                    runtime: 200,
                  },
                  error: null,
                };
              }
              if (table === "tracking") {
                return { data: { status: "watched", rating: 8 }, error: null };
              }
              if (table === "music") {
                return { data: { album_id: albumId, track_number: 2 }, error: null };
              }
              return { data: null, error: null };
            }),
            order: vi.fn(async () => ({ data: [], error: null })),
            then: (resolve: (val: unknown) => void) => {
              if (table === "media_genres") {
                resolve({
                  data: [{ genres: { name: "流行" } }, { genres: { name: "说唱" } }],
                  error: null,
                });
              } else {
                resolve({ data: [], error: null });
              }
            },
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    const result = await readEditableMedia(mockDb, trackId);
    expect(result).toMatchObject({
      type: "music",
      parent_id: albumId,
      number: 2,
      genres: ["流行", "说唱"],
      status: "watched",
      rating: 8,
    });
  });

  it("读取季时根据 v_media_season_summaries 集数统计动态计算观看状态", async () => {
    const mockDb = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (table === "media_items") {
                return {
                  data: {
                    id: "33333333-3333-4333-8333-333333333333",
                    type: "tv_season",
                    title: "第 1 季",
                  },
                  error: null,
                };
              }
              if (table === "v_media_season_summaries") {
                return {
                  data: { episode_count: 10, watched_episode_count: 10 },
                  error: null,
                };
              }
              return { data: null, error: null };
            }),
            order: vi.fn(async () => ({ data: [], error: null })),
            then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    const result = await readEditableMedia(mockDb, "33333333-3333-4333-8333-333333333333");
    expect(result).not.toBeNull();
    expect(result?.status).toBe("watched");
  });
});
