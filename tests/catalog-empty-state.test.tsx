import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CatalogEmptyState from "@/components/CatalogEmptyState";
import MoviesCatalog from "@/app/movies/MoviesCatalog";
import ShowsCatalog from "@/app/shows/ShowsCatalog";
import type { MediaCard } from "@/lib/types";

function movieCard(overrides: Partial<MediaCard> = {}): MediaCard {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "测试电影",
    date: "2024-01-01",
    release_year: "2024",
    rating: 8,
    genres: [],
    languages: [],
    cover_url: "",
    type: "movies",
    ...overrides,
  };
}

describe("CatalogEmptyState", () => {
  it("renders the album-style muted message inside a dashed panel", () => {
    const { container } = render(<CatalogEmptyState message="还没有专辑。" />);
    const panel = container.firstElementChild;
    expect(panel).not.toHaveAttribute("role");
    expect(panel?.className).toContain("border-dashed");
    expect(panel?.className).toContain("rounded-2xl");
    expect(screen.getByText("还没有专辑。")).toHaveClass("text-sm", "text-fg-muted");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders title, description, and a named text link CTA with a decorative arrow", () => {
    render(
      <CatalogEmptyState
        title="还没有电影"
        description="录入作品后，已看与想看会显示在这里。"
        ctaHref="/search?type=movie"
        ctaLabel="去搜索"
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "还没有电影" })).toBeInTheDocument();
    expect(screen.getByText("录入作品后，已看与想看会显示在这里。")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "去搜索" });
    expect(link).toHaveAttribute("href", "/search?type=movie");
    expect(link).toHaveClass("focus-ring", "min-h-10");
    expect(link).toHaveTextContent("去搜索 →");
    const arrow = link.querySelector("[aria-hidden='true']");
    expect(arrow).toBeTruthy();
    expect(arrow).toHaveTextContent("→");
  });
});

describe("MoviesCatalog empty state", () => {
  it("shows the dashed empty panel when stats.total is 0", () => {
    render(<MoviesCatalog watched={[]} want={[]} stats={{ total: 0, watched: 0, want: 0, upcoming: 0 }} />);

    expect(screen.getByRole("heading", { level: 2, name: "还没有电影" })).toBeInTheDocument();
    expect(screen.getByText("录入作品后，已看与想看会显示在这里。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去搜索" })).toHaveAttribute("href", "/search?type=movie");
    expect(screen.queryByRole("heading", { name: "我已看" })).not.toBeInTheDocument();
  });

  it("keeps media rows when at least one section has items", () => {
    render(<MoviesCatalog watched={[movieCard()]} want={[]} stats={{ total: 1, watched: 1, want: 0, upcoming: 0 }} />);

    expect(screen.getByRole("heading", { name: "我已看" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "还没有电影" })).not.toBeInTheDocument();
  });

  it("does not show the empty panel when total is positive but list rows are empty", () => {
    // 例如只有「近期将上映」计入总数，已看／想看分栏仍为空。
    render(<MoviesCatalog watched={[]} want={[]} stats={{ total: 2, watched: 0, want: 0, upcoming: 2 }} />);

    expect(screen.queryByRole("heading", { name: "还没有电影" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /近期将上映/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "去搜索" })).not.toBeInTheDocument();
  });
});

describe("ShowsCatalog empty state", () => {
  it("shows the dashed empty panel when stats.total is 0", () => {
    render(
      <ShowsCatalog
        watched={[]}
        watching={[]}
        want={[]}
        stats={{ total: 0, watched: 0, watching: 0, want: 0, upcoming: 0 }}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "还没有电视节目" })).toBeInTheDocument();
    expect(screen.getByText("录入剧集后，已看、在看与想看会显示在这里。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去搜索" })).toHaveAttribute("href", "/search?type=tv_show");
    expect(screen.queryByRole("heading", { name: "我在看" })).not.toBeInTheDocument();
  });

  it("does not show the empty panel when total is positive but list rows are empty", () => {
    render(
      <ShowsCatalog
        watched={[]}
        watching={[]}
        want={[]}
        stats={{ total: 3, watched: 0, watching: 0, want: 0, upcoming: 3 }}
      />,
    );

    expect(screen.queryByRole("heading", { name: "还没有电视节目" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /近期将播出/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "去搜索" })).not.toBeInTheDocument();
  });
});
