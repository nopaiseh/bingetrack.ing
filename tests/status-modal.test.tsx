import { render, screen, fireEvent, act } from "@testing-library/react";
import { expect, it, vi, beforeEach, afterEach } from "vitest";
import StatusModal from "@/app/manage/StatusModal";

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, "", "/manage/media/123?saved=1&deleted=1");
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

it("渲染包含正确 role=status、无障碍标题与响应式类别的弹窗", () => {
  render(<StatusModal message="保存成功，公开页面缓存已更新。" />);

  const dialog = screen.getByRole("dialog");
  expect(dialog).toBeInTheDocument();
  expect(dialog.className).toContain("pointer-events-none");

  // 必须包含 role="status" 以兼顾无障碍播报与 Playwright E2E 检查
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("保存成功，公开页面缓存已更新。");

  // 验证移动端（底部抽屉）与平板/桌面（居中）适配类名
  expect(dialog.className).toContain("items-end");
  expect(dialog.className).toContain("sm:items-center");

  // 进度条存在
  const progressbar = screen.getByRole("progressbar");
  expect(progressbar).toBeInTheDocument();
});

it("5秒后自动关闭并触发 onClose 回调且清理 URL 参数", async () => {
  const onClose = vi.fn();
  render(<StatusModal message="保存成功，公开页面缓存已更新。" duration={5000} onClose={onClose} />);

  expect(screen.getByRole("status")).toBeInTheDocument();
  expect(window.location.search).toContain("saved=1");

  // 前进 4900ms，弹窗仍在
  act(() => {
    vi.advanceTimersByTime(4900);
  });
  expect(screen.queryByRole("status")).toBeInTheDocument();

  // 前进 200ms（到达 5100ms），触发关闭动画并完成关闭
  act(() => {
    vi.advanceTimersByTime(200);
  });
  // 再前进动画缓冲 250ms
  act(() => {
    vi.advanceTimersByTime(250);
  });

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(window.location.search).not.toContain("saved");
  expect(window.location.search).not.toContain("deleted");
});

it("点击“知道了”按钮立即关闭并清理 URL", async () => {
  const onClose = vi.fn();
  render(<StatusModal message="条目及其下属资料已删除。" onClose={onClose} />);

  const btn = screen.getByRole("button", { name: "知道了" });
  fireEvent.click(btn);

  // 动画延迟后卸载
  act(() => {
    vi.advanceTimersByTime(250);
  });

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(onClose).toHaveBeenCalled();
  expect(window.location.search).not.toContain("deleted");
});

it("点击右上角关闭按钮立即关闭", async () => {
  const onClose = vi.fn();
  render(<StatusModal message="关联已更新。" onClose={onClose} />);

  const closeBtn = screen.getByRole("button", { name: "关闭提示" });
  fireEvent.click(closeBtn);

  act(() => {
    vi.advanceTimersByTime(250);
  });

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(onClose).toHaveBeenCalled();
});

it("按 Escape 键可关闭弹窗", async () => {
  const onClose = vi.fn();
  render(<StatusModal message="保存成功，关联作品已同步更新。" onClose={onClose} />);

  fireEvent.keyDown(window, { key: "Escape" });

  act(() => {
    vi.advanceTimersByTime(250);
  });

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(onClose).toHaveBeenCalled();
});

it("鼠标悬停时暂停倒计时，移出后恢复", async () => {
  const onClose = vi.fn();
  render(<StatusModal message="保存成功，公开页面缓存已更新。" duration={5000} onClose={onClose} />);

  const card = screen.getByRole("dialog").querySelector(".surface-panel, [class*='bg-neutral-900']");
  expect(card).not.toBeNull();

  // 运行 2 秒
  act(() => {
    vi.advanceTimersByTime(2000);
  });

  // 鼠标移入，暂停
  fireEvent.mouseEnter(card!);

  // 在悬停状态下推进 6 秒
  act(() => {
    vi.advanceTimersByTime(6000);
  });

  // 弹窗依然存在，未被关闭
  expect(screen.getByRole("status")).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();

  // 鼠标移出，恢复倒计时
  fireEvent.mouseLeave(card!);

  // 剩余约 3 秒，推进 3.5 秒后应关闭
  act(() => {
    vi.advanceTimersByTime(3500);
  });

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(onClose).toHaveBeenCalled();
});
