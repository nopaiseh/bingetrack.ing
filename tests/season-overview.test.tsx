import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SeasonOverview from "@/components/SeasonOverview";

describe("SeasonOverview", () => {
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
    render(<SeasonOverview text="短简介" />);
    expect(screen.getByText("短简介")).toHaveClass("line-clamp-4");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("超出四行时显示展开／收起并切换 aria-expanded", () => {
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

    render(<SeasonOverview text={"本季从摸索走到定型。".repeat(12)} />);
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
});
