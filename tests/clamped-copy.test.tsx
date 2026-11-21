import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ClampedCopy from "@/components/ClampedCopy";

describe("ClampedCopy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("短文不显示展开按钮", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
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
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    render(<ClampedCopy text="暂无简介。" persistClamp expandLabel="展开全文 ↓" collapseLabel="收起全文 ↑" />);
    expect(screen.getByText("暂无简介。")).toHaveClass("max-w-[70ch]", "line-clamp-4");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
