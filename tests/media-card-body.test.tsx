import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MediaCardBody, { mediaCardAuthorsLine } from "@/components/MediaCardBody";
import type { MediaCard } from "@/lib/types";

function book(partial: Partial<MediaCard> = {}): MediaCard {
  return {
    id: "b1",
    title: "海边的卡夫卡",
    date: "2002-09-12",
    release_year: "2002",
    rating: 8.5,
    genres: ["小说"],
    languages: ["日语"],
    cover_url: "",
    type: "books",
    dbType: "book",
    authors: ["村上春树"],
    ...partial,
  };
}

describe("mediaCardAuthorsLine", () => {
  it("joins author names with ideographic commas and skips blanks", () => {
    expect(mediaCardAuthorsLine(["村上春树", "  ", "柴田元幸"])).toBe("村上春树、柴田元幸");
  });

  it("returns null when there are no usable authors", () => {
    expect(mediaCardAuthorsLine([])).toBeNull();
    expect(mediaCardAuthorsLine(undefined)).toBeNull();
    expect(mediaCardAuthorsLine(["", "  "])).toBeNull();
  });
});

describe("MediaCardBody book authors", () => {
  it("shows authors under the title for books", () => {
    render(<MediaCardBody item={book({ authors: ["村上春树", "柴田元幸"] })} dbType="book" />);
    expect(screen.getByText("海边的卡夫卡")).toBeInTheDocument();
    expect(screen.getByText("村上春树、柴田元幸")).toBeInTheDocument();
    expect(screen.getByText("2002")).toBeInTheDocument();
  });

  it("omits the author line when authors are missing", () => {
    const { container } = render(<MediaCardBody item={book({ authors: [] })} dbType="book" />);
    expect(screen.getByText("海边的卡夫卡")).toBeInTheDocument();
    expect(container.querySelector("p.truncate")).toBeNull();
  });

  it("does not show authors for movies", () => {
    render(<MediaCardBody item={book({ type: "movies", dbType: "movie", authors: ["不应出现"] })} dbType="movie" />);
    expect(screen.queryByText("不应出现")).not.toBeInTheDocument();
  });
});
