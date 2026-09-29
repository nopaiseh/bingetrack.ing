import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath, revalidateTag } from "next/cache";
import { affectedMediaIds, mergeAffected, revalidateMediaItems } from "@/lib/admin/revalidate-media";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const show = "11111111-1111-4111-8111-111111111111";
const season = "22222222-2222-4222-8222-222222222222";
const episode = "33333333-3333-4333-8333-333333333333";
const sequel = "44444444-4444-4444-8444-444444444444";
const collection = "55555555-5555-4555-8555-555555555555";

type Row = Record<string, string>;
// 一部电视节目及其季、单集，和同一作品系列中的另一部作品。
const tables: Record<string, Row[]> = {
  tv_seasons: [{ id: season, series_id: show }],
  tv_episodes: [{ id: episode, season_id: season }],
  media_item_series: [{ media_item_id: show, series_id: collection }, { media_item_id: sequel, series_id: collection }],
};

/** 只实现 from().select().in() 的内存数据库替身，可让指定表返回错误。 */
function fakeDb(failing?: string) {
  return {
    from: (table: string) => ({
      select: (columns: string) => ({
        in: async (key: string, values: string[]) => failing === table
          ? { data: null, error: { message: "boom" } }
          : { data: tables[table].filter(/* 按 in 条件筛选。 */ (row) => values.includes(row[key])).map(/* 只返回所选列。 */ (row) => ({ [columns]: row[columns] })), error: null },
      }),
    }),
  } as unknown as SupabaseClient;
}

beforeEach(() => vi.clearAllMocks());

describe("按条目失效公开缓存", () => {
  it("单集变更沿季找到电视节目，并包含同系列的其他作品", async () => {
    expect(new Set(await affectedMediaIds(fakeDb(), [episode]))).toEqual(new Set([episode, show, sequel]));
  });
  it("季变更包含所属电视节目", async () => {
    expect(await affectedMediaIds(fakeDb(), [season])).toEqual(expect.arrayContaining([season, show]));
  });
  it("忽略非法 ID，不发起查询", async () => {
    expect(await affectedMediaIds(fakeDb("tv_episodes"), ["not-a-uuid"])).toEqual([]);
  });
  it("查询失败时返回 null，并退回全站失效", async () => {
    const ids = await affectedMediaIds(fakeDb("media_item_series"), [show]);
    expect(ids).toBeNull();
    revalidateMediaItems(mergeAffected([sequel], ids));
    expect(revalidateTag).toHaveBeenCalledWith("media", { expire: 0 });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
  it("已知条目只失效各自的标签、聚合数据与无标签目录页", () => {
    revalidateMediaItems(mergeAffected([show], [show, sequel]));
    expect(vi.mocked(revalidateTag).mock.calls).toEqual([
      [`media:item:${show}`, { expire: 0 }],
      [`media:item:${sequel}`, { expire: 0 }],
      ["media:lists", { expire: 0 }],
    ]);
    expect(vi.mocked(revalidatePath).mock.calls).toEqual([["/"], ["/movies"], ["/shows"], ["/sitemap.xml"]]);
  });
});
