import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

vi.mock("@/lib/functions/search-options", () => ({
  fetchSearchOptionsServer: vi.fn().mockResolvedValue({ genres: ["剧情"], regions: [], languages: [], years: [] }),
}));
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

  it("关键词或未知筛选值绕过数据缓存", async () => {
    expect((await initialResultFor({ q: "星光" })).total).toBe(4);
    expect((await initialResultFor({ genre: "不存在的类型" })).total).toBe(4);
    expect(searchCachedMedia).not.toHaveBeenCalled();
  });

  it("参数无效时返回检查条件的提示，而不是加载失败", async () => {
    const result = await initialResultFor({ startYear: "2030", endYear: "2020" });
    expect(result.error).toBe("搜索条件无效，请检查搜索词和筛选条件。");
    expect(searchCachedMedia).not.toHaveBeenCalled();
    expect(searchMediaServer).not.toHaveBeenCalled();
  });
});
