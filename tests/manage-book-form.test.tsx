import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MediaForm from "@/app/(admin)/manage/media/MediaForm";

vi.mock("@/app/(admin)/manage/actions", () => ({
  saveMedia: vi.fn(async () => ({})),
  deleteMedia: vi.fn(),
}));

vi.mock("@/app/(admin)/manage/ChoicePicker", () => ({
  default: ({ label, name }: { label: string; name: string }) => (
    <div>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} />
    </div>
  ),
}));

describe("图书管理表单", () => {
  it("有封面、作者、出版社、页数与三态阅读状态，没有 ISBN／译者／页数进度", () => {
    render(<MediaForm initialType="book" />);

    expect(screen.getByLabelText("封面图片 URL")).toBeInTheDocument();
    expect(screen.getByLabelText("出版日期")).toBeInTheDocument();
    expect(screen.getByLabelText("出版社")).toBeInTheDocument();
    expect(screen.getByLabelText("页数")).toBeInTheDocument();
    expect(screen.getByText("只记录总页数，不跟踪阅读进度。")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "作者" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "阅读状态" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "想读" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "在读" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "读过" })).toBeInTheDocument();

    expect(screen.queryByLabelText(/ISBN/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/译者/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/阅读进度/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/已读页/)).not.toBeInTheDocument();
  });

  it("切换阅读状态会写入隐藏 status 字段", () => {
    const { container } = render(<MediaForm initialType="book" />);
    fireEvent.click(screen.getByRole("button", { name: "在读" }));
    expect(container.querySelector('input[name="status"]')).toHaveValue("in_progress");
    fireEvent.click(screen.getByRole("button", { name: "读过" }));
    expect(container.querySelector('input[name="status"]')).toHaveValue("watched");
  });
});
