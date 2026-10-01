import { render, screen, fireEvent, act } from "@testing-library/react";
import { expect, it, vi, beforeEach, afterEach } from "vitest";
import StatusModal from "@/app/(admin)/manage/StatusModal";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

it("渲染到 body 的简洁提示：只有消息，没有按钮与标题", () => {
  render(<StatusModal message="保存成功，公开页面缓存已更新。" />);

  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("保存成功，公开页面缓存已更新。");
  expect(document.body.contains(status)).toBe(true);
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByRole("heading")).toBeNull();
  expect(status.parentElement!.className).toContain("pointer-events-none");
  expect(status.parentElement!.className).toContain("justify-center");
});

it("失败提示使用 role=alert", () => {
  render(<StatusModal tone="error" message="保存失败。" />);
  expect(screen.getByRole("alert")).toHaveTextContent("保存失败。");
});

it("5秒后自动消失并触发 onClose 回调", () => {
  const onClose = vi.fn();
  render(<StatusModal message="已保存。" onClose={onClose} />);

  act(() => { vi.advanceTimersByTime(4900); });
  expect(screen.getByRole("status")).toBeInTheDocument();

  act(() => { vi.advanceTimersByTime(300); });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("按 Escape 键可提前关闭", () => {
  const onClose = vi.fn();
  render(<StatusModal message="已保存。" onClose={onClose} />);

  fireEvent.keyDown(window, { key: "Escape" });
  act(() => { vi.advanceTimersByTime(250); });

  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(onClose).toHaveBeenCalledTimes(1);
});
