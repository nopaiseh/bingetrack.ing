import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RefreshCacheButton from "@/app/manage/RefreshCacheButton";
import * as actions from "@/app/manage/actions";

vi.mock("@/app/manage/actions", () => ({
  manualRevalidateCache: vi.fn(),
}));

describe("RefreshCacheButton", () => {
  it("点击按钮后触发 manualRevalidateCache 并在成功时显示反馈", async () => {
    vi.mocked(actions.manualRevalidateCache).mockResolvedValue({ saved: true });

    render(<RefreshCacheButton />);
    const button = screen.getByRole("button", { name: /刷新前台缓存/i });
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
    const button = screen.getByRole("button", { name: /刷新前台缓存/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByText("刷新缓存")).toBeInTheDocument();
  });
});

