import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  affectedMediaIds,
  creditedPersonIds,
  mergeAffected,
  referenceMediaIds,
  revalidateMediaItems,
  revalidatePersonItems,
} from "@/lib/admin/revalidate-media";
import { POSTGREST_PAGE_SIZE } from "@/lib/supabase/fetch-all-pages";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const show = "11111111-1111-4111-8111-111111111111";
const season = "22222222-2222-4222-8222-222222222222";
const episode = "33333333-3333-4333-8333-333333333333";
const sequel = "44444444-4444-4444-8444-444444444444";
const collection = "55555555-5555-4555-8555-555555555555";
const person = "66666666-6666-4666-8666-666666666666";
const album = "77777777-7777-4777-8777-777777777777";
const track = "88888888-8888-4888-8888-888888888888";

type Row = Record<string, string>;
// 一部电视节目及其季、单集，和同一作品系列中的另一部作品；人物出演单集两次。
const tables: Record<string, Row[]> = {
  tv_seasons: [{ id: season, series_id: show }],
  tv_episodes: [{ id: episode, season_id: season }],
  album_tracks: [{ song_id: track, album_id: album }],
  media_item_series: [
    { media_item_id: show, series_id: collection },
    { media_item_id: sequel, series_id: collection },
  ],
  media_credits: [
    { media_item_id: episode, person_id: person, role: "actor" },
    { media_item_id: episode, person_id: person, role: "actor" },
    { media_item_id: track, person_id: person, role: "artist" },
  ],
  media_genres: [],
};

type QueryCall = { table: string; ranges: Array<[number, number]> };

/** 只实现 from().select().in().order().range() 的内存数据库替身，可让指定表返回错误。 */
function fakeDb(failing?: string, overrides: Record<string, Row[]> = {}) {
  const data: Record<string, Row[]> = { ...tables, ...overrides };
  const calls: QueryCall[] = [];
  const db = {
    from: (table: string) => {
      const call: QueryCall = { table, ranges: [] };
      calls.push(call);
      let columns = "";
      let filterKey = "";
      let filterValues: string[] = [];
      const builder = {
        select: (selected: string) => {
          columns = selected;
          return builder;
        },
        in: (key: string, values: string[]) => {
          filterKey = key;
          filterValues = values;
          return builder;
        },
        order: () => builder,
        range: async (from: number, to: number) => {
          call.ranges.push([from, to]);
          if (failing === table) return { data: null, error: { message: "boom" } };
          const rows = data[table]
            .filter(/* 按 in 条件筛选。 */ (row) => filterValues.includes(row[filterKey]))
            .map(
              /* 只返回所选列（含逗号分隔的多列时取首列以兼容旧断言）。 */ (row) => {
                const keys = columns.split(",").map((part) => part.trim());
                const out: Row = {};
                for (const key of keys) out[key] = row[key];
                return out;
              },
            );
          return { data: rows.slice(from, to + 1), error: null };
        },
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          builder.range(0, Number.MAX_SAFE_INTEGER).then(resolve, reject),
      };
      return builder;
    },
    calls,
  };
  return db as unknown as SupabaseClient & { calls: QueryCall[] };
}

beforeEach(() => vi.clearAllMocks());

describe("按条目失效公开缓存", () => {
  it("单集变更沿季找到电视节目，并包含同系列的其他作品", async () => {
    expect(new Set(await affectedMediaIds(fakeDb(), [episode]))).toEqual(new Set([episode, show, sequel]));
  });
  it("季变更包含所属电视节目", async () => {
    expect(await affectedMediaIds(fakeDb(), [season])).toEqual(expect.arrayContaining([season, show]));
  });
  it("单曲变更包含所属专辑", async () => {
    expect(new Set(await affectedMediaIds(fakeDb(), [track]))).toEqual(new Set([track, album]));
  });
  it("专辑变更包含其下曲目", async () => {
    expect(new Set(await affectedMediaIds(fakeDb(), [album]))).toEqual(new Set([album, track]));
  });
  it("单曲查询失败时返回 null", async () => {
    expect(await affectedMediaIds(fakeDb("album_tracks"), [track])).toBeNull();
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
  it("引用资料变更沿关联表找到条目，再扩展到所属电视节目与系列成员", async () => {
    expect(new Set(await referenceMediaIds(fakeDb(), "people", [person]))).toEqual(
      new Set([episode, show, sequel, track, album]),
    );
  });
  it("未被引用的资料不波及任何详情页", async () => {
    expect(await referenceMediaIds(fakeDb(), "genres", [person])).toEqual([]);
  });
  it("关联表查询失败时返回 null，由调用方退回全站失效", async () => {
    expect(await referenceMediaIds(fakeDb("media_credits"), "people", [person])).toBeNull();
  });
  it("已知条目只失效各自的标签、聚合数据与无标签目录页", () => {
    revalidateMediaItems(mergeAffected([show], [show, sequel]));
    expect(vi.mocked(revalidateTag).mock.calls).toEqual([
      [`media:item:${show}`, { expire: 0 }],
      [`media:item:${sequel}`, { expire: 0 }],
      ["media:lists", { expire: 0 }],
    ]);
    expect(vi.mocked(revalidatePath).mock.calls).toEqual([
      ["/"],
      ["/movies"],
      ["/shows"],
      ["/albums"],
      ["/books"],
      ["/sitemap.xml"],
    ]);
  });

  it("空受影响列表仍失效 media:lists 与目录路径，覆盖新建无引用资料与筛选选项缓存", () => {
    revalidateMediaItems([]);
    expect(vi.mocked(revalidateTag).mock.calls).toEqual([["media:lists", { expire: 0 }]]);
    expect(vi.mocked(revalidatePath).mock.calls).toEqual([
      ["/"],
      ["/movies"],
      ["/shows"],
      ["/albums"],
      ["/books"],
      ["/sitemap.xml"],
    ]);
    expect(revalidateTag).not.toHaveBeenCalledWith("media", expect.anything());
  });

  it("人物详情按 person:item:<id> 失效，忽略非法 ID", () => {
    revalidatePersonItems([person, "not-a-uuid", person]);
    expect(vi.mocked(revalidateTag).mock.calls).toEqual([
      [`person:item:${person}`, { expire: 0 }],
      [`person:item:${person}`, { expire: 0 }],
    ]);
  });

  it("revalidatePersonItems(null) 退回 person 全站标签", () => {
    revalidatePersonItems(null);
    expect(revalidateTag).toHaveBeenCalledExactlyOnceWith("person", { expire: 0 });
  });

  it("creditedPersonIds：专辑含曲目演职员，曲目只含自身", async () => {
    expect(new Set(await creditedPersonIds(fakeDb(), [album]))).toEqual(new Set([person]));
    expect(await creditedPersonIds(fakeDb(), [track])).toEqual([person]);
    expect(await creditedPersonIds(fakeDb(), [show])).toEqual([]);
  });

  it("creditedPersonIds：credits 查询失败时返回 null", async () => {
    expect(await creditedPersonIds(fakeDb("media_credits"), [track])).toBeNull();
  });

  it("creditedPersonIds：超过 PostgREST 1000 行时翻页读全", async () => {
    const pageSize = POSTGREST_PAGE_SIZE;
    const people = Array.from({ length: pageSize + 5 }, (_, index) => {
      const hex = (index + 1).toString(16).padStart(12, "0");
      return `aaaaaaaa-aaaa-4aaa-8aaa-${hex}`;
    });
    const creditRows = people.map((personId, index) => ({
      media_item_id: track,
      person_id: personId,
      role: `r${index}`,
    }));
    const db = fakeDb(undefined, { media_credits: creditRows });
    const ids = await creditedPersonIds(db, [track]);
    expect(ids).toHaveLength(people.length);
    expect(new Set(ids)).toEqual(new Set(people));
    const creditCalls = (db as unknown as { calls: QueryCall[] }).calls.filter(
      (call) => call.table === "media_credits",
    );
    // 每一页各建一次 from()；翻页时应至少两次 media_credits 查询。
    expect(creditCalls.length).toBeGreaterThanOrEqual(2);
    expect(creditCalls.flatMap((call) => call.ranges)).toEqual([
      [0, POSTGREST_PAGE_SIZE - 1],
      [POSTGREST_PAGE_SIZE, POSTGREST_PAGE_SIZE * 2 - 1],
    ]);
  });
});
