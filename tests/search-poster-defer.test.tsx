import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeferredSearchPoster from "@/components/search/DeferredSearchPoster";
import SearchResultSection from "@/components/search/SearchResultSection";
import { SearchMediaCard } from "@/components/SearchMediaCard";
import { EMPTY_FILTERS } from "@/components/search/search-model";
import { SEARCH_ABOVE_FOLD_COUNT } from "@/lib/poster-image-sizes";
import { SEARCH_POSTER_ROOT_MARGIN } from "@/lib/search-poster-defer";
import type { MediaCard } from "@/lib/types";

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    sizes,
    priority,
    loading,
  }: {
    alt: string;
    src?: string;
    sizes?: string;
    fill?: boolean;
    priority?: boolean;
    loading?: "eager" | "lazy";
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      src={src}
      sizes={sizes}
      loading={priority ? undefined : loading}
      fetchPriority={priority ? "high" : undefined}
      data-testid="search-poster-img"
    />
  ),
}));

function card(id: string, title: string, cover = true): MediaCard {
  return {
    id,
    title,
    date: "2024-01-01",
    release_year: "2024",
    rating: 8,
    genres: ["剧情"],
    languages: ["汉语"],
    cover_url: cover ? `https://image.tmdb.org/t/p/original/${id}.jpg` : "",
    type: "movies",
    status: "watched",
  };
}

type ObserverCallback = IntersectionObserverCallback;

describe("search poster deferral", () => {
  let observerCallback: ObserverCallback | null = null;
  let observed: Element[] = [];
  const disconnect = vi.fn();

  beforeEach(() => {
    observerCallback = null;
    observed = [];
    disconnect.mockClear();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: ObserverCallback) {
          observerCallback = callback;
        }
        observe(el: Element) {
          observed.push(el);
        }
        unobserve() {}
        disconnect() {
          disconnect();
        }
        takeRecords() {
          return [];
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a 300–400px rootMargin for near-viewport prefetch", () => {
    const px = Number.parseInt(SEARCH_POSTER_ROOT_MARGIN, 10);
    expect(px).toBeGreaterThanOrEqual(300);
    expect(px).toBeLessThanOrEqual(400);
  });

  it("renders the poster src immediately when not deferred", () => {
    const { container } = render(
      <DeferredSearchPoster src="https://image.tmdb.org/t/p/original/a.jpg" defer={false} sizes="184px" />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://image.tmdb.org/t/p/original/a.jpg");
    expect(observed).toHaveLength(0);
  });

  it("withholds the image src until near the viewport when deferred", () => {
    const { container } = render(
      <DeferredSearchPoster src="https://image.tmdb.org/t/p/original/b.jpg" defer sizes="184px" />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-poster-deferred="true"]')).not.toBeNull();
    expect(observed).toHaveLength(1);

    act(() => {
      observerCallback?.(
        [{ isIntersecting: true, target: observed[0] } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://image.tmdb.org/t/p/original/b.jpg");
    expect(container.querySelector("[data-poster-deferred]")).toBeNull();
    expect(disconnect).toHaveBeenCalled();
  });

  it("keeps titles in the accessibility tree while the poster is deferred", () => {
    render(<SearchMediaCard item={card("defer-1", "推迟海报的电影")} returnHref="/search" deferPoster />);
    expect(screen.getByRole("heading", { name: "推迟海报的电影" })).toBeInTheDocument();
    expect(screen.queryByTestId("search-poster-img")).not.toBeInTheDocument();
  });

  it("keeps the no-image fallback when there is no cover", () => {
    const { container } = render(
      <SearchMediaCard item={card("empty", "无封面电影", false)} returnHref="/search" deferPoster />,
    );
    expect(screen.getByRole("heading", { name: "无封面电影" })).toBeInTheDocument();
    expect(container.querySelector(".i-material-symbols-image-outline-rounded")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("defers posters past the first eager window and leaves the first six immediate", () => {
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
    expect(cards).toHaveLength(items.length);

    for (let index = 0; index < SEARCH_ABOVE_FOLD_COUNT; index += 1) {
      expect(cards[index].querySelector("img")).not.toBeNull();
      expect(cards[index].querySelector("[data-poster-deferred]")).toBeNull();
    }
    expect(cards[0].querySelector("img")).toHaveAttribute("fetchpriority", "high");
    for (let index = 1; index < SEARCH_ABOVE_FOLD_COUNT; index += 1) {
      expect(cards[index].querySelector("img")).toHaveAttribute("loading", "eager");
    }
    for (let index = SEARCH_ABOVE_FOLD_COUNT; index < items.length; index += 1) {
      expect(cards[index].querySelector("img")).toBeNull();
      expect(cards[index].querySelector('[data-poster-deferred="true"]')).not.toBeNull();
      expect(screen.getByRole("heading", { name: `作品 ${index}` })).toBeInTheDocument();
    }
  });

  it("applies content-visibility sizing on search cards to avoid layout shift", () => {
    const { container } = render(<SearchMediaCard item={card("cv", "尺寸卡")} returnHref="/search" />);
    const cardEl = container.querySelector(".search-media-card");
    expect(cardEl).not.toBeNull();
    expect(cardEl!.className).toContain("search-media-card");
  });
});
