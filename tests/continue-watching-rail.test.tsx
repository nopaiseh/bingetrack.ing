import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ContinueWatchingRail, {
  continueWatchingEpisodeLine,
  continueWatchingPosterSrc,
  type ContinueWatchingCard,
} from "@/components/ContinueWatchingRail";

function card(overrides: Partial<ContinueWatchingCard> = {}): ContinueWatchingCard {
  return {
    showId: "show-1",
    title: "跑男",
    posterPath: "/abc.jpg",
    href: "/shows/show-1",
    nextEpisode: {
      seasonNumber: 2,
      episodeNumber: 5,
      title: "集名",
      href: "/shows/show-1/seasons/season-2",
    },
    seasonProgress: { seasonNumber: 2, watched: 33, total: 51 },
    ...overrides,
  };
}

describe("continue watching poster paths", () => {
  it("builds a w342 TMDB url for a single-segment path and keeps site paths", () => {
    expect(continueWatchingPosterSrc("/abc.jpg")).toBe("https://image.tmdb.org/t/p/w342/abc.jpg");
    expect(continueWatchingPosterSrc("/already/poster.jpg")).toBe("/already/poster.jpg");
    expect(continueWatchingPosterSrc(null)).toBeNull();
    expect(continueWatchingPosterSrc("  ")).toBeNull();
    expect(continueWatchingPosterSrc("//evil.example/a.jpg")).toBeNull();
  });

  it("omits a null episode name and switches copy when the season is finished", () => {
    expect(continueWatchingEpisodeLine(card().nextEpisode)).toBe("S2 · E5 集名");
    expect(continueWatchingEpisodeLine({ ...card().nextEpisode!, title: null })).toBe("S2 · E5");
    expect(continueWatchingEpisodeLine(null)).toBe("本季已看完");
  });
});

describe("ContinueWatchingRail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hides the whole section when there is nothing to continue", () => {
    const { container } = render(<ContinueWatchingRail items={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("heading", { name: "继续观看" })).not.toBeInTheDocument();
  });

  it("links to the season page and shows the episode, progress, and poster", () => {
    render(<ContinueWatchingRail items={[card()]} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/shows/show-1/seasons/season-2");
    expect(link).toHaveTextContent("跑男");
    expect(link).toHaveTextContent("S2 · E5 集名");
    expect(link).toHaveTextContent("打开第 2 季");
    expect(link).toHaveTextContent("第 2 季 33/51");
    expect(link).not.toHaveTextContent("天前");
    const poster = screen.getByRole("img", { name: "跑男" });
    expect(decodeURIComponent(poster.getAttribute("src") ?? "")).toContain("https://image.tmdb.org/t/p/w342/abc.jpg");
    expect(poster).toHaveAttribute("loading", "eager");
    expect(screen.getByRole("progressbar", { name: "第 2 季已看 33 集，共 51 集" })).toHaveAttribute("aria-valuenow", "33");
    expect(screen.getByRole("heading", { level: 3, name: "跑男" }).className).toContain("line-clamp-2");
    expect(screen.getByRole("heading", { name: "继续观看" })).toBeInTheDocument();
  });

  it("uses the show page and a finished-season line when there is no next episode", () => {
    render(<ContinueWatchingRail items={[card({
      title: "航海王",
      posterPath: null,
      nextEpisode: null,
      seasonProgress: { seasonNumber: 1, watched: 40, total: 40 },
    })]} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/shows/show-1");
    expect(link).toHaveTextContent("本季已看完");
    expect(link).toHaveTextContent("打开节目页");
    expect(link).not.toHaveTextContent("S1");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(document.querySelector("[data-poster-fallback]")?.textContent).toBe("航");
    expect(screen.getByRole("progressbar", { name: "第 1 季已看 40 集，共 40 集" })).toHaveAttribute("aria-valuenow", "40");
  });

  it("does not render lastWatchedAt even when the payload still has it", () => {
    render(<ContinueWatchingRail items={[{ ...card(), lastWatchedAt: "3 天前" } as ContinueWatchingCard]} />);
    expect(screen.getByRole("link")).not.toHaveTextContent("天前");
    expect(screen.getByRole("link")).not.toHaveTextContent("1970");
  });

  it("keeps the list keyboard scrollable and shows desktop controls only when it overflows", () => {
    const scrollBy = vi.fn();
    const descriptors = {
      scrollWidth: Object.getOwnPropertyDescriptor(Element.prototype, "scrollWidth"),
      clientWidth: Object.getOwnPropertyDescriptor(Element.prototype, "clientWidth"),
    };
    Object.defineProperty(Element.prototype, "scrollWidth", { configurable: true, get: () => 900 });
    Object.defineProperty(Element.prototype, "clientWidth", { configurable: true, get: () => 300 });
    Object.defineProperty(HTMLElement.prototype, "scrollBy", { configurable: true, value: scrollBy });

    try {
      render(<ContinueWatchingRail items={[card(), card({ showId: "show-2", title: "爱情公寓", posterPath: "/love.jpg" })]} />);
      expect(screen.getByRole("img", { name: "爱情公寓" })).toHaveAttribute("loading", "lazy");
      const scroller = screen.getByLabelText("继续观看列表");
      expect(scroller).toHaveAttribute("tabindex", "0");

      const next = screen.getByRole("button", { name: "向右滚动继续观看" });
      expect(next.className).toContain("md:flex");
      expect(screen.getByRole("button", { name: "向左滚动继续观看" }).className).not.toContain("md:flex");

      fireEvent.keyDown(scroller, { key: "ArrowRight" });
      expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: expect.any(Number) }));
      const distance = scrollBy.mock.calls[0]?.[0].left as number;
      expect(distance).toBeGreaterThan(0);

      fireEvent.click(next);
      expect(scrollBy).toHaveBeenCalledTimes(2);
    } finally {
      if (descriptors.scrollWidth) Object.defineProperty(Element.prototype, "scrollWidth", descriptors.scrollWidth);
      if (descriptors.clientWidth) Object.defineProperty(Element.prototype, "clientWidth", descriptors.clientWidth);
    }
  });
});
