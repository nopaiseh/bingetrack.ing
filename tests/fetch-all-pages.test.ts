import { describe, expect, it, vi } from "vitest";
import { fetchAllPages, POSTGREST_PAGE_SIZE } from "@/lib/supabase/fetch-all-pages";

vi.mock("server-only", () => ({}));

describe("fetchAllPages", () => {
  it("单页不足 pageSize 时一次返回全部", async () => {
    const load = vi.fn(async (from: number, to: number) => {
      expect(from).toBe(0);
      expect(to).toBe(2);
      return { data: [{ id: 1 }, { id: 2 }], error: null };
    });
    await expect(fetchAllPages(load, 3)).resolves.toEqual({
      data: [{ id: 1 }, { id: 2 }],
      error: null,
    });
    expect(load).toHaveBeenCalledOnce();
  });

  it("超过一页时翻页拼完整结果（证明 >1000 行不丢）", async () => {
    const total = POSTGREST_PAGE_SIZE + 17;
    const all = Array.from({ length: total }, (_, index) => ({ id: index + 1 }));
    const load = vi.fn(async (from: number, to: number) => ({
      data: all.slice(from, to + 1),
      error: null,
    }));
    const result = await fetchAllPages(load);
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(total);
    expect(result.data?.[0]).toEqual({ id: 1 });
    expect(result.data?.[total - 1]).toEqual({ id: total });
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenNthCalledWith(1, 0, POSTGREST_PAGE_SIZE - 1);
    expect(load).toHaveBeenNthCalledWith(2, POSTGREST_PAGE_SIZE, POSTGREST_PAGE_SIZE * 2 - 1);
  });

  it("任一页出错时返回 error 且 data 为 null", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ data: Array.from({ length: 3 }, (_, id) => ({ id })), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(fetchAllPages(load, 3)).resolves.toEqual({ data: null, error: { message: "boom" } });
  });
});
