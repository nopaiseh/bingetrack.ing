import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchMediaCard } from "@/components/SearchMediaCard";
import type { MediaCard } from "@/lib/types";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

function book(partial: Partial<MediaCard> = {}): MediaCard {
  return {
    id: "book-1",
    title: "测试图书",
    date: "2020-01-01",
    release_year: 2020,
    rating: 8,
    genres: ["小说"],
    languages: ["中文"],
    cover_url: "",
    type: "books",
    dbType: "book",
    status: "in_progress",
    ...partial,
  };
}

describe("SearchMediaCard books", () => {
  it("图书卡与影视同为 2:3，无封面用首字块，链到 /books", () => {
    const { container } = render(<SearchMediaCard item={book()} returnHref="/search" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", expect.stringContaining("/books/book-1"));
    expect(container.querySelector(".aspect-2\\/3, [class*='aspect-2/3']")).toBeTruthy();
    expect(container.querySelector("[data-initial]")).toBeTruthy();
    expect(screen.getByTestId("media-card-status-badge")).toHaveTextContent("在读");
  });

  it("图书不显示即将上映角标", () => {
    render(<SearchMediaCard item={book({ status: "want_to_watch", date: "2099-01-01" })} returnHref="/search" />);
    expect(screen.queryByTestId("media-card-upcoming-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("media-card-status-badge")).toHaveTextContent("想读");
  });
});
