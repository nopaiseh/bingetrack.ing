// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));
vi.mock("@/lib/functions/search-options", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/functions/search-options")>()),
  fetchSearchOptionsServer: vi
    .fn()
    .mockResolvedValue({ genres: ["剧情"], regions: ["日本"], languages: ["日语"], years: [] }),
}));
vi.mock("@/lib/functions/media-repo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/functions/media-repo")>();
  return { ...actual, searchMediaServer: vi.fn() };
});

import * as Sentry from "@sentry/nextjs";
import { GET } from "@/app/api/media/route";
import { fetchSearchOptionsServer } from "@/lib/functions/search-options";
import { MediaRepositoryError, searchMediaServer } from "@/lib/functions/media-repo";

const get = (query: string) => GET(new Request(`https://www.bingetrack.ing/api/media?${query}`));

describe("GET /api/media", () => {
  beforeEach(() => {
    vi.mocked(searchMediaServer).mockReset().mockResolvedValue({ rows: [], total: 0 });
    vi.mocked(fetchSearchOptionsServer).mockClear();
    vi.mocked(Sentry.captureException).mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("现有选项正常查询并允许 CDN 缓存", async () => {
    const response = await get(`genre=${encodeURIComponent("剧情")}&region=${encodeURIComponent("日本")}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=30");
    expect(searchMediaServer).toHaveBeenCalledOnce();
  });

  it("没有类型／地区／语言筛选时不读取选项", async () => {
    expect((await get("q=matrix")).status).toBe(200);
    expect(fetchSearchOptionsServer).not.toHaveBeenCalled();
  });

  it.each([
    `genre=${encodeURIComponent("剧情,{x}")}`,
    `region=${encodeURIComponent("火星")}`,
    `language=${encodeURIComponent('"')}`,
  ])("未知筛选值返回 400，不查询数据库：%s", async (query) => {
    const response = await get(query);
    expect(response.status).toBe(400);
    expect(searchMediaServer).not.toHaveBeenCalled();
  });

  it("数据库查询失败时 Sentry 含 PostgREST 字段，客户端响应不含", async () => {
    const db = {
      code: "42703",
      message: "column v_all_media.authors does not exist",
      details: null as string | null,
      hint: "Review the view definition.",
    };
    vi.mocked(searchMediaServer).mockRejectedValue(new MediaRepositoryError("fetch media list", db));

    const response = await get("q=test");
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "Unable to load media" });
    expect(JSON.stringify(body)).not.toContain("42703");
    expect(JSON.stringify(body)).not.toContain("does not exist");
    expect(JSON.stringify(body)).not.toContain("v_all_media");

    expect(Sentry.captureException).toHaveBeenCalledOnce();
    const [, options] = vi.mocked(Sentry.captureException).mock.calls[0]!;
    expect(options).toMatchObject({
      tags: { "db.code": "42703", "db.query": "fetch media list" },
      contexts: {
        postgrest: {
          code: "42703",
          message: "column v_all_media.authors does not exist",
          details: null,
          hint: "Review the view definition.",
          query: "fetch media list",
        },
      },
      extra: {
        message: "Media API request failed:",
        query: "fetch media list",
        db,
      },
    });
  });
});
