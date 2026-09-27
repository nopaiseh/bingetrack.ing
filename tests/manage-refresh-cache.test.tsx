import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RefreshCacheButton from "@/app/(admin)/manage/RefreshCacheButton";
import * as actions from "@/app/(admin)/manage/actions";

vi.mock("@/app/(admin)/manage/actions", () => ({
  manualRevalidateCache: vi.fn(),
}));

describe("RefreshCacheButton", () => {
  it("点击按钮后触发 manualRevalidateCache 并在成功时显示反馈", async () => {
    vi.mocked(actions.manualRevalidateCache).mockResolvedValue({ saved: true });

    render(<RefreshCacheButton />);
    const button = screen.getByRole("button", { name: /刷新缓存/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    expect(actions.manualRevalidateCache).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByText(/缓存已刷新/i)).toBeInTheDocument();
    });
  });

  it("渲染紧凑版按钮（compact）", async () => {
    vi.mocked(actions.manualRevalidateCache).mockResolvedValue({ saved: true });

    render(<RefreshCacheButton compact />);
    const button = screen.getByRole("button", { name: /刷新缓存/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByText("刷新缓存")).toBeInTheDocument();
  });
});

