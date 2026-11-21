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

  it("电影、电视节目的目录和详情页因即将上映按日期变化，保留每天重建一次", () => {
    expect(moviesRevalidate).toBe(86400);
    expect(showsRevalidate).toBe(86400);
    expect(movieDetailRevalidate).toBe(86400);
    expect(showDetailRevalidate).toBe(86400);
  });

  it("图书、专辑、季页与站点地图只靠路径／标签失效", () => {
    expect(albumsRevalidate).toBe(false);
    expect(booksRevalidate).toBe(false);
    expect(albumDetailRevalidate).toBe(false);
    expect(bookDetailRevalidate).toBe(false);
    expect(seasonRevalidate).toBe(false);
    expect(sitemapRevalidate).toBe(false);
  });
});
