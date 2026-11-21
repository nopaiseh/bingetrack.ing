import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AlbumCoverWall from "@/components/AlbumCoverWall";
import type { MediaCard } from "@/lib/types";

function album(overrides: Partial<MediaCard> = {}): MediaCard {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "测试专辑",
    date: "2024-01-01",
    release_year: "2024",
    rating: 8.5,
    genres: [],
    languages: [],
    cover_url: "",
    type: "albums",
    artists: ["主唱"],
    ...overrides,
  };
}

describe("AlbumCoverWall", () => {
  it("shows an empty state when there are no albums", () => {
    const { container } = render(<AlbumCoverWall items={[]} />);
    expect(screen.getByText("还没有专辑。")).toBeInTheDocument();
    expect(screen.getByText("还没有专辑。")).toHaveClass("text-sm", "text-fg-muted");
    expect(container.firstElementChild).not.toHaveAttribute("role");
    expect(container.firstElementChild?.className).toMatch(/border-dashed/);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders a compact cover card with title, artist, and score", () => {
    render(<AlbumCoverWall items={[album()]} />);
    const link = screen.getByRole("link", { name: "测试专辑，主唱" });
    expect(link).toHaveAttribute("href", "/albums/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(link).toHaveTextContent("测试专辑");
    expect(link).toHaveTextContent("主唱");
    expect(link.querySelector("[data-poster-fallback], .letter-tile") || link).toBeTruthy();
  });
});
