import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import AlbumsCatalog from "@/app/albums/AlbumsCatalog";
import MoviesCatalog from "@/app/movies/MoviesCatalog";
import ShowsCatalog from "@/app/shows/ShowsCatalog";
import type { MediaCard } from "@/lib/types";

const placeholderCard: MediaCard = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "占位",
  date: "2024-01-01",
  release_year: "2024",
  rating: 8,
  genres: [],
  languages: [],
  cover_url: "",
  type: "movies",
};

test("zero upcoming shows are omitted so the mobile grid is not left with an empty-result card", () => {
  render(
    <ShowsCatalog
      watched={[{ ...placeholderCard, type: "shows" }]}
      watching={[]}
      want={[]}
      stats={{ total: 8, watched: 4, watching: 3, want: 1, upcoming: 0 }}
    />,
  );

  expect(screen.getByRole("link", { name: /电视节目总数量/ })).toHaveAttribute("href", "/search?type=tv_show");
  expect(screen.getByRole("link", { name: /已看的电视节目/ })).toBeInTheDocument();
  expect(screen.queryByText("近期将播出")).not.toBeInTheDocument();
  expect(screen.getAllByRole("link").every((link) => !link.getAttribute("href")?.includes("upcoming"))).toBe(true);
});

test("a positive upcoming movie count stays linked", () => {
  render(
    <MoviesCatalog watched={[placeholderCard]} want={[]} stats={{ total: 67, watched: 60, want: 7, upcoming: 1 }} />,
  );

  expect(screen.getByRole("link", { name: /近期将上映/ })).toHaveAttribute(
    "href",
    "/search?type=movie&status=upcoming&sort=date_asc",
  );
  // 4 张统计卡链接 + 分栏「查看全部」+ 至少一张卡片链接
  expect(screen.getAllByRole("link").length).toBeGreaterThanOrEqual(4);
  expect(screen.queryByRole("heading", { name: "还没有电影" })).not.toBeInTheDocument();
});

test("an empty catalog keeps the total and does not link to an empty search", () => {
  render(<MoviesCatalog watched={[]} want={[]} stats={{ total: 0, watched: 0, want: 0, upcoming: 0 }} />);

  expect(screen.getByRole("heading", { name: "电影总数量" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /电影总数量/ })).not.toBeInTheDocument();
  expect(screen.queryByText("近期将上映")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "还没有电影" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "去搜索" })).toHaveAttribute("href", "/search?type=movie");
});

test("upcoming-only catalogs keep stats and skip the empty-state panel", () => {
  render(<MoviesCatalog watched={[]} want={[]} stats={{ total: 1, watched: 0, want: 0, upcoming: 1 }} />);

  expect(screen.getByRole("heading", { name: "电影总数量" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /近期将上映/ })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "还没有电影" })).not.toBeInTheDocument();
});

test("album scheme A links five independent stats including music track total", () => {
  render(
    <AlbumsCatalog
      watched={[{ ...placeholderCard, type: "albums", dbType: "album", title: "示例专辑", artists: ["示例艺人"] }]}
      watching={[]}
      want={[]}
      stats={{ total: 12, watched: 5, watching: 2, want: 3, trackTotal: 48 }}
    />,
  );

  expect(screen.getByRole("link", { name: /专辑总数量/ })).toHaveAttribute("href", "/search?type=album");
  expect(screen.getByRole("link", { name: /歌曲总数量/ })).toHaveAttribute("href", "/search?type=music");
  expect(screen.getByRole("link", { name: /已听的专辑/ })).toHaveAttribute("href", "/search?type=album&status=watched");
  expect(screen.getByRole("link", { name: /在听的专辑/ })).toHaveAttribute(
    "href",
    "/search?type=album&status=watching",
  );
  expect(screen.getByRole("link", { name: /想听的专辑/ })).toHaveAttribute(
    "href",
    "/search?type=album&status=want_to_watch",
  );
  expect(screen.getByRole("heading", { name: "我已听" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /查看全部/ })).toHaveAttribute("href", "/search?type=album&status=watched");
});

test("an empty album catalog keeps the muted total and hides zero-value cards", () => {
  render(
    <AlbumsCatalog
      watched={[]}
      watching={[]}
      want={[]}
      stats={{ total: 0, watched: 0, watching: 0, want: 0, trackTotal: 0 }}
    />,
  );

  expect(screen.getByRole("heading", { name: "专辑总数量" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /专辑总数量/ })).not.toBeInTheDocument();
  expect(screen.queryByText("歌曲总数量")).not.toBeInTheDocument();
  expect(screen.queryByText("已听的专辑")).not.toBeInTheDocument();
  expect(screen.getByText("还没有专辑。")).toBeInTheDocument();
});
