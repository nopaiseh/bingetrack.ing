import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SeasonFilterBar from "@/components/SeasonFilterBar";

const CHIP =
  "tap-target-expand inline-flex shrink-0 items-center justify-center rounded-lg border px-4 py-1.5 text-[13px]";

/** 渲染带多枚芯片的筛选条，便于模拟横向溢出。 */
function renderBar() {
  return render(
    <SeasonFilterBar
      measureKey="test"
      chips={
        <>
          <button type="button" className={CHIP}>
            全部
          </button>
          <button type="button" className={CHIP}>
            已看
          </button>
          <button type="button" className={CHIP}>
            未看
          </button>
          <button type="button" className={CHIP}>
            升序 ↑
          </button>
          <button type="button" className={CHIP}>
            评分高
          </button>
          <button type="button" className={CHIP}>
            近更新
          </button>
        </>
      }
      trailing="42 集"
    />,
  );
}

describe("SeasonFilterBar", () => {
  const descriptors = {
    scrollWidth: Object.getOwnPropertyDescriptor(Element.prototype, "scrollWidth"),
    clientWidth: Object.getOwnPropertyDescriptor(Element.prototype, "clientWidth"),
    scrollLeft: Object.getOwnPropertyDescriptor(Element.prototype, "scrollLeft"),
  };

  afterEach(() => {
    if (descriptors.scrollWidth) Object.defineProperty(Element.prototype, "scrollWidth", descriptors.scrollWidth);
    if (descriptors.clientWidth) Object.defineProperty(Element.prototype, "clientWidth", descriptors.clientWidth);
    if (descriptors.scrollLeft) Object.defineProperty(Element.prototype, "scrollLeft", descriptors.scrollLeft);
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    Object.defineProperty(Element.prototype, "scrollWidth", { configurable: true, get: () => 200 });
    Object.defineProperty(Element.prototype, "clientWidth", { configurable: true, get: () => 200 });
    Object.defineProperty(Element.prototype, "scrollLeft", { configurable: true, get: () => 0 });
  });

  it("无溢出时不显示左右箭头，滚动容器使用 motion-safe:scroll-smooth", async () => {
    renderBar();
    const bar = screen.getByTestId("season-filter-bar");
    await waitFor(() => {
      expect(bar).toHaveAttribute("data-can-scroll-right", "0");
      expect(bar).toHaveAttribute("data-can-scroll-left", "0");
    });
    expect(screen.queryByRole("button", { name: "向右滚动筛选选项" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "向左滚动筛选选项" })).not.toBeInTheDocument();

    const scroller = screen.getByRole("group", { name: "筛选与排序" });
    expect(scroller.className).toContain("motion-safe:scroll-smooth");
    expect(scroller.className).not.toMatch(/(?:^|\s)scroll-smooth(?:\s|$)/);
  });

  it("右侧溢出时显示向右箭头（中文 aria-label、focus-ring、40px 点击类），点击会滚动", async () => {
    const scrollBy = vi.fn();
    Object.defineProperty(Element.prototype, "scrollWidth", { configurable: true, get: () => 900 });
    Object.defineProperty(Element.prototype, "clientWidth", { configurable: true, get: () => 300 });
    Object.defineProperty(HTMLElement.prototype, "scrollBy", { configurable: true, value: scrollBy });

    renderBar();
    const bar = screen.getByTestId("season-filter-bar");
    await waitFor(() => {
      expect(bar).toHaveAttribute("data-can-scroll-right", "1");
    });

    const right = screen.getByRole("button", { name: "向右滚动筛选选项" });
    expect(right).toHaveAttribute("aria-label", "向右滚动筛选选项");
    expect(right.className).toContain("focus-ring");
    expect(right.className).toContain("size-10");
    expect(right.className).toContain("tap-target-expand");
    expect(screen.queryByRole("button", { name: "向左滚动筛选选项" })).not.toBeInTheDocument();

    fireEvent.click(right);
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: expect.any(Number) }));
    expect((scrollBy.mock.calls[0]?.[0] as { left: number }).left).toBeGreaterThan(0);
  });

  it("左侧可回滚时显示向左箭头，点击会向左滚动", async () => {
    const scrollBy = vi.fn();
    Object.defineProperty(Element.prototype, "scrollWidth", { configurable: true, get: () => 900 });
    Object.defineProperty(Element.prototype, "clientWidth", { configurable: true, get: () => 300 });
    Object.defineProperty(Element.prototype, "scrollLeft", { configurable: true, get: () => 200 });
    Object.defineProperty(HTMLElement.prototype, "scrollBy", { configurable: true, value: scrollBy });

    renderBar();
    const bar = screen.getByTestId("season-filter-bar");
    await waitFor(() => {
      expect(bar).toHaveAttribute("data-can-scroll-left", "1");
      expect(bar).toHaveAttribute("data-can-scroll-right", "1");
    });

    const left = screen.getByRole("button", { name: "向左滚动筛选选项" });
    expect(left).toHaveAttribute("aria-label", "向左滚动筛选选项");
    expect(left.className).toContain("focus-ring");
    expect(left.className).toContain("size-10");

    fireEvent.click(left);
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: expect.any(Number) }));
    expect((scrollBy.mock.calls[0]?.[0] as { left: number }).left).toBeLessThan(0);
  });

  it("滚动容器可用方向键翻动", async () => {
    const scrollBy = vi.fn();
    Object.defineProperty(Element.prototype, "scrollWidth", { configurable: true, get: () => 900 });
    Object.defineProperty(Element.prototype, "clientWidth", { configurable: true, get: () => 300 });
    Object.defineProperty(HTMLElement.prototype, "scrollBy", { configurable: true, value: scrollBy });

    renderBar();
    await waitFor(() => {
      expect(screen.getByTestId("season-filter-bar")).toHaveAttribute("data-can-scroll-right", "1");
    });

    const scroller = screen.getByRole("group", { name: "筛选与排序" });
    fireEvent.keyDown(scroller, { key: "ArrowRight" });
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: expect.any(Number) }));
  });

  it("prefers-reduced-motion 时程序化滚动使用 auto 而非 smooth", async () => {
    const scrollBy = vi.fn();
    Object.defineProperty(Element.prototype, "scrollWidth", { configurable: true, get: () => 900 });
    Object.defineProperty(Element.prototype, "clientWidth", { configurable: true, get: () => 300 });
    Object.defineProperty(HTMLElement.prototype, "scrollBy", { configurable: true, value: scrollBy });
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
      })),
    );

    renderBar();
    await waitFor(() => {
      expect(screen.getByTestId("season-filter-bar")).toHaveAttribute("data-can-scroll-right", "1");
    });
    fireEvent.click(screen.getByRole("button", { name: "向右滚动筛选选项" }));
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
  });
});
