import { render, screen, act } from "@testing-library/react";
import { expect, test, vi, beforeEach, afterEach } from "vitest";
import AnimatedNumber from "@/components/AnimatedNumber";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test("AnimatedNumber renders initial value immediately without raf animation", () => {
  const rafSpy = vi.spyOn(window, "requestAnimationFrame");
  render(<AnimatedNumber value={100} />);
  
  expect(screen.getByText("100")).toBeInTheDocument();
  // 首屏水合阶段不应调用 requestAnimationFrame 动画循环
  expect(rafSpy).not.toHaveBeenCalled();
});

test("AnimatedNumber renders decimals correctly", () => {
  render(<AnimatedNumber value={9.54} decimals={1} />);
  expect(screen.getByText("9.5")).toBeInTheDocument();
});

test("AnimatedNumber smoothly animates on value update", () => {
  const rafSpy = vi.spyOn(window, "requestAnimationFrame");
  const { rerender } = render(<AnimatedNumber value={10} />);
  expect(screen.getByText("10")).toBeInTheDocument();

  rerender(<AnimatedNumber value={20} />);
  // 值变更时应调用 requestAnimationFrame 启动过渡动画
  expect(rafSpy).toHaveBeenCalled();

  act(() => {
    vi.advanceTimersByTime(600);
  });
});

