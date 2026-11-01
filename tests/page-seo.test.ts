import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/functions/media-repo", () => ({
  fetchStatsServer: vi.fn(),
  fetchMediaCardsServer: vi.fn(),
}));

vi.mock("@/app/movies/MoviesCatalog", () => ({ default: () => null }));
vi.mock("@/app/shows/ShowsCatalog", () => ({ default: () => null }));

import { metadata as moviesMetadata } from "@/app/movies/page";
import { metadata as showsMetadata } from "@/app/shows/page";
import { metadata as searchMetadata } from "@/app/search/layout";
import { buildPageSocialMetadata } from "@/lib/seo/page";

describe("page social metadata", /* 组织电影、电视节目和搜索页的分享元数据测试。 */ () => {
  it("builds Open Graph and Twitter fields from the page title, description, and path", /* 验证分享标题、描述和地址跟随页面，且不写入规范链接。 */ () => {
    const metadata = buildPageSocialMetadata(
      "电影",
      "浏览已看、想看与即将上映的电影记录。",
      "/movies",
    );

    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      locale: "zh_CN",
      siteName: "bingetrack.ing",
      title: "电影",
      description: "浏览已看、想看与即将上映的电影记录。",
      url: "/movies",
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "电影",
      description: "浏览已看、想看与即将上映的电影记录。",
    });
  });

  it("attaches page-specific share metadata to the three listing routes", /* 验证电影、电视节目和搜索路由各自使用对应标题、描述与地址。 */ () => {
    expect(moviesMetadata).toMatchObject({
      title: "电影",
      description: "浏览已看、想看与即将上映的电影记录。",
      openGraph: { url: "/movies" },
      twitter: { title: "电影" },
    });
    expect(showsMetadata).toMatchObject({
      title: "电视节目",
      description: "浏览已看、在看与想看的电视节目记录。",
      openGraph: { url: "/shows" },
      twitter: { title: "电视节目" },
    });
    expect(searchMetadata).toMatchObject({
      title: "搜索",
      description: "按标题、演职员、类型、年份、地区与语言检索媒体记录。",
      openGraph: { url: "/search" },
      twitter: { title: "搜索" },
    });
    expect(moviesMetadata.alternates).toEqual({ canonical: "/movies" });
    expect(showsMetadata.alternates).toEqual({ canonical: "/shows" });
    // 搜索的规范地址由页面按查询参数决定，布局只提供分享信息。
    expect(searchMetadata.alternates).toBeUndefined();
  });
});
