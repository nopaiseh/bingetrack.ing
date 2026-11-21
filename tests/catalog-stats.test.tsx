import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
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
  expect(screen.getByRole("link", { name: "去搜索 →" })).toHaveAttribute("href", "/search?type=movie");
});
