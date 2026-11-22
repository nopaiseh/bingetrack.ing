import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MusicCardBody from "@/components/MusicCardBody";
import type { MediaCard } from "@/lib/types";

function album(partial: Partial<MediaCard> = {}): MediaCard {
  return {
    id: "a1",
    title: "夜色电台",
    date: "2024-03-01",
    release_year: "2024",
    rating: 9,
    genres: ["独立流行", "城市民谣"],
    languages: [],
    cover_url: "",
    type: "albums",
    dbType: "album",
    artists: ["林澄"],
    ...partial,
  };
}

describe("MusicCardBody", () => {
  it("shows year, rating tier, and genre chips", () => {
    render(<MusicCardBody item={album()} />);
    expect(screen.getByText("夜色电台")).toBeInTheDocument();
    expect(screen.getByText("林澄")).toBeInTheDocument();
    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getByText("9.0")).toBeInTheDocument();
    expect(screen.getByText("独立流行")).toBeInTheDocument();
    expect(screen.getByText("城市民谣")).toBeInTheDocument();
  });

  it("shows 未评分 and keeps genre row height when empty", () => {
    const { container } = render(
      <MusicCardBody item={album({ rating: null, genres: [], artists: [] })} artistFallback="dash" />,
    );
    expect(screen.getByText("未评分")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(container.querySelector(".min-h-6")).toBeTruthy();
  });
});
