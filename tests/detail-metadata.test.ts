import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Media } from "@/lib/types";

vi.mock("@/lib/functions/cached-media", () => ({
  getCachedMediaById: vi.fn(),
  getCachedAlbumDetail: vi.fn(),
}));

vi.mock("@/lib/supabase/public-server", () => ({
  getSupabasePublicServer: vi.fn(),
}));

import { generateMetadata as movieMetadata } from "@/app/movies/[id]/page";
import { generateMetadata as showMetadata } from "@/app/shows/[id]/page";
import BookDetailPage, { generateMetadata as bookMetadata } from "@/app/books/[id]/page";
import { getCachedMediaById } from "@/lib/functions/cached-media";
import { getSupabasePublicServer } from "@/lib/supabase/public-server";

const id = "03cad04d-b4be-4930-b3de-8e58a4eda9ef";

function media(partial: Partial<Media> & Pick<Media, "type" | "title">): Media {
  return {
    id,
    date: "2024-01-01",
    rating: null,
    genres: [],
    languages: [],
    cover_url: "",
    ...partial,
  };
}

describe("详情页 generateMetadata 类型校验", () => {
  beforeEach(() => {
    vi.mocked(getCachedMediaById).mockReset();
  });

  it("电影页：类型不符与缺失同样返回未找到标题", async () => {
    vi.mocked(getCachedMediaById).mockResolvedValueOnce(null);
    await expect(movieMetadata({ params: Promise.resolve({ id }) })).resolves.toEqual({ title: "电影未找到" });

    vi.mocked(getCachedMediaById).mockResolvedValueOnce(media({ type: "shows", title: "剧集" }));
    await expect(movieMetadata({ params: Promise.resolve({ id }) })).resolves.toEqual({ title: "电影未找到" });

    vi.mocked(getCachedMediaById).mockResolvedValueOnce(media({ type: "movies", title: "电影甲" }));
    await expect(movieMetadata({ params: Promise.resolve({ id }) })).resolves.toMatchObject({ title: "电影甲" });
  });

  it("电视节目页：类型不符与缺失同样返回未找到标题", async () => {
    vi.mocked(getCachedMediaById).mockResolvedValueOnce(media({ type: "movies", title: "电影" }));
    await expect(showMetadata({ params: Promise.resolve({ id }) })).resolves.toEqual({ title: "电视节目未找到" });

    vi.mocked(getCachedMediaById).mockResolvedValueOnce(media({ type: "shows", title: "节目甲" }));
    await expect(showMetadata({ params: Promise.resolve({ id }) })).resolves.toMatchObject({ title: "节目甲" });
  });

  it("图书页：类型不符与缺失同样返回未找到标题", async () => {
    vi.mocked(getCachedMediaById).mockResolvedValueOnce(media({ type: "albums", title: "专辑" }));
    await expect(bookMetadata({ params: Promise.resolve({ id }) })).resolves.toEqual({ title: "图书未找到" });

    vi.mocked(getCachedMediaById).mockResolvedValueOnce(media({ type: "books", title: "图书甲" }));
    await expect(bookMetadata({ params: Promise.resolve({ id }) })).resolves.toMatchObject({ title: "图书甲" });
  });
});

describe("图书详情 loadBookMeta", () => {
  beforeEach(() => {
    vi.mocked(getCachedMediaById).mockReset();
    vi.mocked(getSupabasePublicServer).mockReset();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function mockBooksQuery(result: { data: unknown; error: unknown }) {
    const maybeSingle = vi.fn().mockResolvedValue(result);
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    vi.mocked(getSupabasePublicServer).mockReturnValue({ from } as never);
    return { from };
  }

  it("查不到行时返回空出版社／页数，页面仍可渲染", async () => {
    vi.mocked(getCachedMediaById).mockResolvedValue(media({ type: "books", title: "空元数据" }));
    mockBooksQuery({ data: null, error: null });

    const page = await BookDetailPage({ params: Promise.resolve({ id }) });
    expect(page).toBeTruthy();
  });

  it("运行期查库出错时抛出，避免永久缓存降级结果", async () => {
    vi.mocked(getCachedMediaById).mockResolvedValue(media({ type: "books", title: "失败书" }));
    mockBooksQuery({ data: null, error: { message: "db down" } });

    await expect(BookDetailPage({ params: Promise.resolve({ id }) })).rejects.toMatchObject({ message: "db down" });
  });

  it("构建期查库出错时降级为空元数据", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getCachedMediaById).mockResolvedValue(media({ type: "books", title: "构建书" }));
    mockBooksQuery({ data: null, error: { message: "db down" } });

    const page = await BookDetailPage({ params: Promise.resolve({ id }) });
    expect(page).toBeTruthy();
    expect(log).toHaveBeenCalled();
  });
});
