import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SearchResultSection from "@/components/search/SearchResultSection";
import { SearchMediaCard } from "@/components/SearchMediaCard";
import { SEARCH_ABOVE_FOLD_COUNT, SEARCH_POSTER_SIZES } from "@/lib/poster-image-sizes";
import { EMPTY_FILTERS } from "@/components/search/search-model";
import type { MediaCard } from "@/lib/types";

vi.mock("next/image", () => ({
  default: ({
    alt,
    preload,
    loading,
    sizes,
    fetchPriority,
  }: {
    alt: string;
    preload?: boolean;
    loading?: "eager" | "lazy";
    sizes?: string;
    fill?: boolean;
    fetchPriority?: "high" | "low" | "auto";
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      sizes={sizes}
      data-preload={preload ? "true" : undefined}
      loading={preload ? undefined : loading}
      fetchPriority={fetchPriority}
    />
  ),
}));

function card(id: string, title: string): MediaCard {
  return {
    id,
    title,
    date: "2024-01-01",
    release_year: "2024",
    rating: 8,
    genres: ["剧情"],
    languages: ["汉语"],
    cover_url: `https://image.tmdb.org/t/p/original/${id}.jpg`,
    type: "movies",
    status: "watched",
  };
}

describe("search poster preload loading", () => {
  it("marks the first search poster as preload with high fetch priority and the above-fold set as eager", () => {
    const { container, unmount } = render(
      <SearchMediaCard item={card("a", "首卡")} returnHref="/search" preload eager />,
    );
    const first = container.querySelector("img");
    expect(first).not.toBeNull();
    // preload + fetchPriority=high restore deprecated priority LCP behavior; loading omitted.
    expect(first).toHaveAttribute("data-preload", "true");
    expect(first).toHaveAttribute("fetchpriority", "high");
    expect(first!.getAttribute("loading")).toBeNull();
    expect(first).toHaveAttribute("sizes", SEARCH_POSTER_SIZES);
    unmount();

    const secondView = render(<SearchMediaCard item={card("b", "次卡")} returnHref="/search" eager />);
    const second = secondView.container.querySelector("img");
    expect(second).toHaveAttribute("loading", "eager");
    expect(second!.getAttribute("data-preload")).not.toBe("true");
    expect(second!.getAttribute("fetchpriority")).not.toBe("high");
    expect(second).toHaveAttribute("sizes", SEARCH_POSTER_SIZES);
  });

  it("lazy-loads posters past the above-the-fold window", () => {
    const { container } = render(<SearchMediaCard item={card("z", "折行")} returnHref="/search" />);
    expect(container.querySelector("img")).toHaveAttribute("loading", "lazy");
  });

  it("applies preload and eager across the first search result row(s)", () => {
    const items = Array.from({ length: SEARCH_ABOVE_FOLD_COUNT + 2 }, (_, index) =>
      card(`id-${index}`, `作品 ${index}`),
    );

    const { container } = render(
      <SearchResultSection
        filters={EMPTY_FILTERS}
        mediaItems={items}
        total={items.length}
        page={1}
        totalPages={1}
        isLoading={false}
        requestError={null}
        queryTooLong={false}
        rangeLabel={null}
        returnHref="/search"
        canResetSearch={false}
        urlQuery=""
        onRetry={() => {}}
        onReset={() => {}}
        onSuggest={() => {}}
        onPage={() => {}}
      />,
    );

    const cards = [...container.querySelectorAll(".search-media-card")];
    const images = [...container.querySelectorAll(".search-media-card img")];
    // Below-fold cards defer the img node until near the viewport.
    expect(images).toHaveLength(SEARCH_ABOVE_FOLD_COUNT);
    expect(images[0]).toHaveAttribute("data-preload", "true");
    expect(images[0]).toHaveAttribute("fetchpriority", "high");
    expect(images[0]!.getAttribute("loading")).toBeNull();
    for (let index = 1; index < SEARCH_ABOVE_FOLD_COUNT; index += 1) {
      expect(images[index]).toHaveAttribute("loading", "eager");
      expect(images[index]!.getAttribute("fetchpriority")).not.toBe("high");
    }
    expect(cards[SEARCH_ABOVE_FOLD_COUNT].querySelector('[data-poster-deferred="true"]')).not.toBeNull();
    expect(cards[SEARCH_ABOVE_FOLD_COUNT + 1].querySelector('[data-poster-deferred="true"]')).not.toBeNull();
  });
});
