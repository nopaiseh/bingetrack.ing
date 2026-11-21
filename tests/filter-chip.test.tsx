import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FilterChip from "@/components/search/FilterChip";

describe("FilterChip", () => {
  it("展示分类与标签文案，移除按钮带无障碍名称并触发回调", () => {
    const onRemove = vi.fn();
    render(<FilterChip category="类型" label="科幻" onRemove={onRemove} />);

    expect(screen.getByText("类型:")).toBeInTheDocument();
    expect(screen.getByText("科幻")).toBeInTheDocument();
    const remove = screen.getByRole("button", { name: "移除类型筛选：科幻" });
    fireEvent.click(remove);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("分类与状态强调色时仍保持相同文案与移除语义", () => {
    const onRemove = vi.fn();
    render(<FilterChip category="分类" label="电影" accent onRemove={onRemove} />);

    expect(screen.getByText("分类:")).toBeInTheDocument();
    expect(screen.getByText("电影")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "移除分类筛选：电影" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
