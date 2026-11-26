import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import HorizontalMediaScroller, {
  HORIZONTAL_MEDIA_CARD_CLASS,
  HORIZONTAL_MEDIA_SCROLL_BTN_TOP_POSTER,
  scrollHorizontalMediaRow,
} from "@/components/HorizontalMediaScroller";

describe("HorizontalMediaScroller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a unified title bar, view-all link, and snap scroller with reduced-motion-safe class", () => {
    const { container } = render(
      <HorizontalMediaScroller
        title="我已看"
        viewAllLink="/shows"
        scrollButtonTopClass={HORIZONTAL_MEDIA_SCROLL_BTN_TOP_POSTER}
      >
        <div className={HORIZONTAL_MEDIA_CARD_CLASS}>卡片</div>
      </HorizontalMediaScroller>,
    );

    expect(screen.getByRole("heading", { level: 2, name: "我已看" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /查看全部/ })).toHaveAttribute("href", "/shows");
    const scroller = screen.getByRole("group", { name: "我已看列表" });
    expect(scroller).toHaveAttribute("tabindex", "0");
    expect(scroller).toHaveAttribute("aria-label", "我已看列表");
    expect(scroller.className).toContain("motion-safe:scroll-smooth");
    expect(scroller.className).not.toMatch(/(?:^|\s)scroll-smooth(?:\s|$)/);
    expect(scroller.className).toContain("snap-x");
    expect(scroller.className).toContain("snap-mandatory");
    expect(container.querySelector("[class*='w-40']")?.className).toContain("sm:w-48");
  });

  it("page buttons include motion-reduce override for active scale", () => {
    render(
      <HorizontalMediaScroller title="在看" scrollButtonTopClass={HORIZONTAL_MEDIA_SCROLL_BTN_TOP_POSTER}>
        <div className={HORIZONTAL_MEDIA_CARD_CLASS}>一</div>
      </HorizontalMediaScroller>,
    );

    const next = screen.getByRole("button", { name: "向右滚动 在看", hidden: true });
    expect(next.className).toContain("active:scale-95");
    expect(next.className).toContain("motion-reduce:active:scale-100");
  });

  it("shows edge controls when overflowing and scrolls ~75% width via buttons and arrow keys", () => {
    const scrollBy = vi.fn();
    const descriptors = {
      scrollWidth: Object.getOwnPropertyDescriptor(Element.prototype, "scrollWidth"),
      clientWidth: Object.getOwnPropertyDescriptor(Element.prototype, "clientWidth"),
    };
    Object.defineProperty(Element.prototype, "scrollWidth", { configurable: true, get: () => 1000 });
    Object.defineProperty(Element.prototype, "clientWidth", { configurable: true, get: () => 400 });
    Object.defineProperty(HTMLElement.prototype, "scrollBy", { configurable: true, value: scrollBy });

    try {
      render(
        <HorizontalMediaScroller title="在看" scrollButtonTopClass={HORIZONTAL_MEDIA_SCROLL_BTN_TOP_POSTER}>
          <div className={HORIZONTAL_MEDIA_CARD_CLASS}>一</div>
          <div className={HORIZONTAL_MEDIA_CARD_CLASS}>二</div>
        </HorizontalMediaScroller>,
      );

      const next = screen.getByRole("button", { name: "向右滚动 在看" });
      expect(next.className).toContain("flex");
      expect(screen.getByRole("button", { name: "向左滚动 在看", hidden: true }).className).toContain("hidden");

      fireEvent.click(next);
      expect(scrollBy).toHaveBeenCalledWith({ left: 300, behavior: expect.any(String) });

      const scroller = screen.getByRole("group", { name: "在看列表" });
      fireEvent.keyDown(scroller, { key: "ArrowLeft" });
      expect(scrollBy).toHaveBeenCalledWith({ left: -300, behavior: expect.any(String) });
    } finally {
      if (descriptors.scrollWidth) Object.defineProperty(Element.prototype, "scrollWidth", descriptors.scrollWidth);
      if (descriptors.clientWidth) Object.defineProperty(Element.prototype, "clientWidth", descriptors.clientWidth);
    }
  });

  it("moves focus to the scroller when the focused page button becomes disabled at an edge", () => {
    let scrollLeft = 0;
    const descriptors = {
      scrollWidth: Object.getOwnPropertyDescriptor(Element.prototype, "scrollWidth"),
      clientWidth: Object.getOwnPropertyDescriptor(Element.prototype, "clientWidth"),
      scrollLeft: Object.getOwnPropertyDescriptor(Element.prototype, "scrollLeft"),
    };
    Object.defineProperty(Element.prototype, "scrollWidth", { configurable: true, get: () => 1000 });
    Object.defineProperty(Element.prototype, "clientWidth", { configurable: true, get: () => 400 });
    Object.defineProperty(Element.prototype, "scrollLeft", {
      configurable: true,
      get() {
        return scrollLeft;
      },
      set(value: number) {
        scrollLeft = value;
      },
    });

    try {
      render(
        <HorizontalMediaScroller title="在听" scrollButtonTopClass={HORIZONTAL_MEDIA_SCROLL_BTN_TOP_POSTER}>
          <div className={HORIZONTAL_MEDIA_CARD_CLASS}>一</div>
          <div className={HORIZONTAL_MEDIA_CARD_CLASS}>二</div>
        </HorizontalMediaScroller>,
      );

      const next = screen.getByRole("button", { name: "向右滚动 在听" });
      const scroller = screen.getByRole("group", { name: "在听列表" });
      next.focus();
      expect(document.activeElement).toBe(next);

      // 滚到右边缘：右钮 disabled+hidden，焦点应回到可聚焦的滚动列表。
      act(() => {
        scrollLeft = 600;
        fireEvent.scroll(scroller);
      });

      expect(next).toBeDisabled();
      expect(next.className).toContain("hidden");
      expect(document.activeElement).toBe(scroller);
    } finally {
      if (descriptors.scrollWidth) Object.defineProperty(Element.prototype, "scrollWidth", descriptors.scrollWidth);
      if (descriptors.clientWidth) Object.defineProperty(Element.prototype, "clientWidth", descriptors.clientWidth);
      if (descriptors.scrollLeft) Object.defineProperty(Element.prototype, "scrollLeft", descriptors.scrollLeft);
    }
  });

  it("scrollHorizontalMediaRow respects prefers-reduced-motion", () => {
    const el = { clientWidth: 200, scrollBy: vi.fn() } as unknown as HTMLElement;
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion: reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    scrollHorizontalMediaRow(el, "right");
    expect(el.scrollBy).toHaveBeenCalledWith({ left: 150, behavior: "auto" });
  });
});
