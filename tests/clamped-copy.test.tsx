import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ClampedCopy, { resolveClampLines } from "@/components/ClampedCopy";

function stubResizeObserver() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
}

describe("resolveClampLines", () => {
  it("默认：persistClamp 为 4，否则为 3", () => {
    expect(resolveClampLines(undefined, true)).toBe(4);
    expect(resolveClampLines(undefined, false)).toBe(3);
  });

  it("接受任意正整数，截断小数；非法值回落默认", () => {
    expect(resolveClampLines(1, false)).toBe(1);
    expect(resolveClampLines(5, true)).toBe(5);
    expect(resolveClampLines(2.9, false)).toBe(2);
    expect(resolveClampLines(0, true)).toBe(4);
    expect(resolveClampLines(-3, false)).toBe(3);
    expect(resolveClampLines(Number.NaN, true)).toBe(4);
    expect(resolveClampLines(Number.POSITIVE_INFINITY, false)).toBe(3);
  });
});

describe("ClampedCopy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("短文不显示展开按钮", () => {
    stubResizeObserver();
    render(<ClampedCopy text="短简介" persistClamp lines={4} fullWidth expandLabel="展开" collapseLabel="收起" />);
    expect(screen.getByText("短简介")).toHaveClass("line-clamp-4", "min-w-0");
    expect(screen.getByText("短简介")).not.toHaveClass("max-w-[70ch]");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("超出截断时显示展开／收起并切换 aria-expanded", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        callback: ResizeObserverCallback;
        constructor(callback: ResizeObserverCallback) {
          this.callback = callback;
        }
        observe(target: Element) {
          Object.defineProperty(target, "scrollHeight", { configurable: true, get: () => 200 });
          Object.defineProperty(target, "clientHeight", { configurable: true, get: () => 80 });
          this.callback([], this as unknown as ResizeObserver);
        }
        unobserve() {}
        disconnect() {}
      },
    );

    render(
      <ClampedCopy
        text={"本季从摸索走到定型。".repeat(12)}
        persistClamp
        lines={4}
        fullWidth
        expandLabel="展开"
        collapseLabel="收起"
      />,
    );
    const toggle = screen.getByRole("button", { name: "展开" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveClass("min-h-11");
    expect(screen.getByText(/本季从摸索走到定型/)).toHaveClass("line-clamp-4");

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "收起" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/本季从摸索走到定型/)).not.toHaveClass("line-clamp-4");

    fireEvent.click(screen.getByRole("button", { name: "收起" }));
    expect(screen.getByRole("button", { name: "展开" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/本季从摸索走到定型/)).toHaveClass("line-clamp-4");
  });

  it("默认仍限制 70ch，详情页 persistClamp 用四行", () => {
    stubResizeObserver();
    render(<ClampedCopy text="暂无简介。" persistClamp expandLabel="展开全文 ↓" collapseLabel="收起全文 ↑" />);
    expect(screen.getByText("暂无简介。")).toHaveClass("max-w-[70ch]", "line-clamp-4");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("未传 lines 时仍为三行静态类（与改前一致）", () => {
    stubResizeObserver();
    render(<ClampedCopy text="普通简介。" />);
    expect(screen.getByText("普通简介。")).toHaveClass("line-clamp-3", "lg:line-clamp-none");
  });

  it("非 3／4 正整数走 CSS 变量截断，不生成动态 line-clamp-* 类名", () => {
    stubResizeObserver();
    render(<ClampedCopy text="五行简介。" persistClamp lines={5} />);
    const copy = screen.getByText("五行简介。");
    expect(copy).toHaveClass("clamped-copy-n");
    expect(copy).not.toHaveClass("line-clamp-5", "line-clamp-3", "line-clamp-4");
    expect(copy.style.getPropertyValue("--clamp-lines")).toBe("5");
  });

  it("非法 lines 回落默认静态类", () => {
    stubResizeObserver();
    render(<ClampedCopy text="非法行数。" persistClamp lines={0} />);
    expect(screen.getByText("非法行数。")).toHaveClass("line-clamp-4");
    expect(screen.getByText("非法行数。")).not.toHaveClass("clamped-copy-n");
  });
});
