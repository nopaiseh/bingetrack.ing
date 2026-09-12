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
                    { role: "actor", people: { name: "Actor A" } },
                    { role: "actor", people: null },
                    null,
                    { role: "director", people: { name: "Director B" } },
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
    expect(result?.actors).toEqual(["Actor A"]);
    expect(result?.directors).toEqual(["Director B"]);
  });
});

