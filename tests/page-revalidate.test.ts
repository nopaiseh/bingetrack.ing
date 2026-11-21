import { describe, expect, it } from "vitest";
import { revalidate as homeRevalidate } from "@/app/page";
import { revalidate as moviesRevalidate } from "@/app/movies/page";
import { revalidate as showsRevalidate } from "@/app/shows/page";
import { revalidate as albumsRevalidate } from "@/app/albums/page";
import { revalidate as booksRevalidate } from "@/app/books/page";
import { revalidate as movieDetailRevalidate } from "@/app/movies/[id]/page";
import { revalidate as showDetailRevalidate } from "@/app/shows/[id]/page";
import { revalidate as albumDetailRevalidate } from "@/app/albums/[id]/page";
import { revalidate as bookDetailRevalidate } from "@/app/books/[id]/page";
import { revalidate as seasonRevalidate } from "@/app/shows/[id]/seasons/[seasonId]/page";
import { revalidate as sitemapRevalidate } from "@/app/sitemap";

describe("页面 ISR revalidate", () => {
  it("首页因倒计时按新加坡日期变化保留 1 小时定时重建", () => {
    expect(homeRevalidate).toBe(3600);
  });

  it("目录、详情与站点地图改为只靠路径／标签失效", () => {
    expect(moviesRevalidate).toBe(false);
    expect(showsRevalidate).toBe(false);
    expect(albumsRevalidate).toBe(false);
    expect(booksRevalidate).toBe(false);
    expect(movieDetailRevalidate).toBe(false);
    expect(showDetailRevalidate).toBe(false);
    expect(albumDetailRevalidate).toBe(false);
    expect(bookDetailRevalidate).toBe(false);
    expect(seasonRevalidate).toBe(false);
    expect(sitemapRevalidate).toBe(false);
  });
});
