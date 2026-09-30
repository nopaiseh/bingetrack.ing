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
    expect(screen.getByText("刷新缓存")).toBeInTheDocument();

    fireEvent.click(button);

    expect(actions.manualRevalidateCache).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByText("已刷新")).toBeInTheDocument();
    });
  });

  it("只显示图标时通过朗读区域播报结果", async () => {
    vi.mocked(actions.manualRevalidateCache).mockResolvedValue({ saved: true });

    render(<RefreshCacheButton iconOnly />);
    fireEvent.click(screen.getByRole("button", { name: "刷新公开缓存" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("缓存已刷新");
    });
  });
});

