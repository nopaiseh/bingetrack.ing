import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

vi.mock("@/lib/functions/search-options", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/functions/search-options")>(),
  fetchSearchOptionsServer: vi.fn().mockResolvedValue({ genres: ["剧情", "喜剧"], regions: [], languages: [], years: [] }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/lib/functions/cached-media", () => ({ searchCachedMedia: vi.fn() }));
vi.mock("@/lib/functions/media-repo", () => ({ searchMediaServer: vi.fn() }));
vi.mock("@/lib/report-error", () => ({ reportHandledError: vi.fn() }));
vi.mock("@/app/search/SearchClient", () => ({ default: () => null }));

import SearchPage from "@/app/search/page";
import { searchCachedMedia } from "@/lib/functions/cached-media";
import { searchMediaServer } from "@/lib/functions/media-repo";

type InitialResult = { rows: unknown[]; total: number; error: string | null };

/** 渲染搜索页服务端组件并取出传给客户端组件的首屏结果。 */
async function initialResultFor(query: Record<string, string>) {
  const element = await SearchPage({ searchParams: Promise.resolve(query) }) as ReactElement<{ initialResult: InitialResult }>;
  return element.props.initialResult;
}

describe("SearchPage", () => {
  beforeEach(() => {
    vi.mocked(searchCachedMedia).mockReset().mockResolvedValue({ rows: [], total: 3 });
    vi.mocked(searchMediaServer).mockReset().mockResolvedValue({ rows: [], total: 4 });
  });

  it("只缓存无关键词且筛选值均为已知选项的查询", async () => {
    expect((await initialResultFor({ genre: "剧情" })).total).toBe(3);
    expect(searchCachedMedia).toHaveBeenCalledTimes(1);
    expect(searchMediaServer).not.toHaveBeenCalled();
  });

  it("关键词绕过数据缓存", async () => {
    expect((await initialResultFor({ q: "星光" })).total).toBe(4);
    expect(searchCachedMedia).not.toHaveBeenCalled();
  });

  it("类型、地区或语言含未知值时返回 404，不查询数据库", async () => {
    const queries: Record<string, string>[] = [{ genre: "不存在的类型" }, { genre: "剧情,不存在的类型" }, { region: "火星" }];
    for (const query of queries) {
      await expect(initialResultFor(query), JSON.stringify(query)).rejects.toThrow("NOT_FOUND");
    }
    expect(searchCachedMedia).not.toHaveBeenCalled();
    expect(searchMediaServer).not.toHaveBeenCalled();
  });

  it("翻页、年份范围与多选组合绕过数据缓存，缓存键数量保持有界", async () => {
    const queries: Record<string, string>[] = [{ genre: "剧情", page: "2" }, { startYear: "2020" }, { endYear: "2020" }, { genre: "剧情,喜剧" }];
    for (const query of queries) {
      expect((await initialResultFor(query)).total, JSON.stringify(query)).toBe(4);
    }
    expect(searchCachedMedia).not.toHaveBeenCalled();
  });

  it("参数无效时返回检查条件的提示，而不是加载失败", async () => {
    const result = await initialResultFor({ startYear: "2030", endYear: "2020" });
    expect(result.error).toBe("搜索条件无效，请检查搜索词和筛选条件。");
    expect(searchCachedMedia).not.toHaveBeenCalled();
    expect(searchMediaServer).not.toHaveBeenCalled();
  });
});
