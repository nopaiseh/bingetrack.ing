import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MediaRow, { resolveRowDbType } from "@/components/MediaRow";
import { SearchMediaCard } from "@/components/SearchMediaCard";
import { dbTypeToPublicRoute, publicPathForDbType } from "@/lib/media-types";
import type { MediaCard } from "@/lib/types";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

function card(partial: Partial<MediaCard> & Pick<MediaCard, "id" | "title" | "dbType">): MediaCard {
  return {
    date: "2024-01-01",
    release_year: "2024",
    rating: 8,
    genres: ["剧情"],
    languages: ["汉语"],
    cover_url: "",
    status: "watched",
    ...partial,
  };
}

describe("卡片只认数据库类型", () => {
  it("映射集中在 media-types：db → 公开路由／详情路径", () => {
    expect(dbTypeToPublicRoute("movie")).toBe("movies");
    expect(dbTypeToPublicRoute("tv_show")).toBe("shows");
    expect(dbTypeToPublicRoute("album")).toBe("albums");
    expect(dbTypeToPublicRoute("book")).toBe("books");
    expect(dbTypeToPublicRoute("music")).toBeNull();
    expect(publicPathForDbType("movie", "m1")).toBe("/movies/m1");
    expect(publicPathForDbType("tv_show", "s1")).toBe("/shows/s1");
    expect(publicPathForDbType("album", "a1")).toBe("/albums/a1");
    expect(publicPathForDbType("book", "b1")).toBe("/books/b1");
    expect(publicPathForDbType("music", "t1")).toBeNull();
  });

  it("SearchMediaCard：仅有 dbType 时链接与形态正确，不依赖路由段 type", () => {
    const movie = card({ id: "m1", title: "只认电影", dbType: "movie" });
    const { unmount } = render(<SearchMediaCard item={movie} returnHref="/search" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/movies/m1?from=%2Fsearch");
    unmount();

    const show = card({ id: "s1", title: "只认剧集", dbType: "tv_show", release_year: "2018 - 2020" });
    render(<SearchMediaCard item={show} returnHref="/search?q=1" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/shows/s1?from=%2Fsearch%3Fq%3D1");
    expect(screen.getByText("2018–2020")).toBeInTheDocument();
  });

  it("SearchMediaCard：缺少 dbType 时不可点进详情（无路由段回退）", () => {
    render(
      <SearchMediaCard
        item={card({ id: "x", title: "无库类型", dbType: undefined, type: "movies" })}
        returnHref="/search"
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "无库类型" })).toBeInTheDocument();
  });

  it("SearchMediaCard：专辑／单曲按 dbType 用方封面；单曲无公开详情", () => {
    const { container, rerender } = render(
      <SearchMediaCard
        item={card({ id: "a1", title: "专辑", dbType: "album", artists: ["艺人"] })}
        returnHref="/search"
      />,
    );
    expect(container.querySelector("[class*='aspect-square']")).toBeTruthy();
    expect(screen.getByRole("link")).toHaveAttribute("href", expect.stringContaining("/albums/a1"));

    rerender(
      <SearchMediaCard
        item={card({ id: "t1", title: "单曲", dbType: "music", artists: ["艺人"] })}
        returnHref="/search"
      />,
    );
    expect(container.querySelector("[class*='aspect-square']")).toBeTruthy();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("MediaRow：行级与单卡均用数据库类型映射链接", () => {
    render(
      <MediaRow
        title="精选"
        type="movie"
        items={[
          card({ id: "m1", title: "电影甲", dbType: "movie" }),
          card({ id: "s1", title: "剧集乙", dbType: "tv_show", type: "shows" }),
          card({ id: "b1", title: "图书丙", dbType: "book", type: "books" }),
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /电影甲/ })).toHaveAttribute("href", "/movies/m1");
    expect(screen.getByRole("link", { name: /剧集乙/ })).toHaveAttribute("href", "/shows/s1");
    expect(screen.getByRole("link", { name: /图书丙/ })).toHaveAttribute("href", "/books/b1");
  });

  it("MediaRow：专辑用 1:1 封面与艺人正文，并映射到 /albums", () => {
    const { container } = render(
      <MediaRow
        title="我已听"
        type="album"
        hideStatusBadge
        viewAllLink="/search?type=album&status=watched"
        items={[
          card({
            id: "a1",
            title: "范特西",
            dbType: "album",
            type: "albums",
            artists: ["周杰伦"],
            rating: 9.2,
            cover_url: "",
          }),
        ]}
      />,
    );

    expect(container.querySelector("[class*='aspect-square']")).toBeTruthy();
    expect(container.querySelector("[class*='aspect-2/3']")).toBeNull();
    const link = screen.getByRole("link", { name: "范特西，周杰伦" });
    expect(link).toHaveAttribute("href", "/albums/a1");
    expect(link).toHaveAccessibleName("范特西，周杰伦");
    expect(screen.getByText("9.2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /查看全部/ })).toHaveAttribute("href", "/search?type=album&status=watched");
    expect(container.querySelector("[data-initial]")).toBeTruthy();
  });

  it("resolveRowDbType：识别专辑／影视／图书；单曲不回落行级 type", () => {
    expect(resolveRowDbType(card({ id: "a1", title: "专辑", dbType: "album" }), "movie")).toBe("album");
    expect(resolveRowDbType(card({ id: "m1", title: "电影", dbType: "movie" }), "album")).toBe("movie");
    expect(resolveRowDbType(card({ id: "s1", title: "剧", dbType: "tv_show" }))).toBe("tv_show");
    expect(resolveRowDbType(card({ id: "b1", title: "书", dbType: "book" }), "movie")).toBe("book");
    expect(resolveRowDbType(card({ id: "t1", title: "单曲", dbType: "music" }), "album")).toBeNull();
    expect(resolveRowDbType(card({ id: "x", title: "无库类型", dbType: undefined }), "album")).toBe("album");
  });

  it("MediaRow：专辑行里的单曲不被当成专辑链出去", () => {
    render(
      <MediaRow
        title="混排"
        type="album"
        items={[
          card({ id: "a1", title: "正经专辑", dbType: "album", artists: ["艺人"] }),
          card({ id: "t1", title: "混进单曲", dbType: "music", artists: ["艺人"] }),
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "正经专辑，艺人" })).toHaveAttribute("href", "/albums/a1");
    expect(screen.queryByRole("link", { name: /混进单曲/ })).not.toBeInTheDocument();
    expect(screen.queryByText("混进单曲")).not.toBeInTheDocument();
  });

  it("SearchMediaCard：艺人与标题相同时正文不重复艺人行；类型只在封面", () => {
    const { container, rerender } = render(
      <SearchMediaCard
        item={card({ id: "a1", title: "自命名", dbType: "album", artists: ["自命名"], date: "2020-01-01" })}
        returnHref="/search"
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "自命名" })).toBeInTheDocument();
    expect(screen.getByText("2020")).toBeInTheDocument();
    expect(container.querySelectorAll("p").length).toBe(0);
    expect(screen.getByText("音乐")).toBeInTheDocument();
    expect(container.querySelectorAll("span").length).toBeGreaterThan(0);
    // 封面类型徽标存在；正文不再另渲染一枚类型标签
    const typeBadges = Array.from(container.querySelectorAll("span")).filter((el) => el.textContent === "音乐");
    expect(typeBadges).toHaveLength(1);

    rerender(
      <SearchMediaCard
        item={card({ id: "t1", title: "龙卷风", dbType: "music", artists: ["周杰伦"], date: "2000-01-01" })}
        returnHref="/search"
      />,
    );
    expect(screen.getByText("周杰伦")).toBeInTheDocument();
    expect(screen.getByText("单曲")).toBeInTheDocument();
  });
});
