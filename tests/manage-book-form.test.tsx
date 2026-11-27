import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MediaForm from "@/app/(admin)/manage/media/MediaForm";

vi.mock("@/app/(admin)/manage/actions", () => ({
  saveMedia: vi.fn(async () => ({})),
  deleteMedia: vi.fn(),
}));

vi.mock("@/app/(admin)/manage/ChoicePicker", () => ({
  default: ({
    label,
    name,
    initial = [],
  }: {
    label: string;
    name: string;
    initial?: { id: string; name: string }[];
  }) => (
    <div>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} />
      {initial.map((choice) => (
        <span key={`${name}-${choice.id}`}>{choice.name}</span>
      ))}
    </div>
  ),
}));

describe("图书管理表单", () => {
  it("有封面、作者、出版社、ISBN、页数与三态阅读状态，没有译者／页数进度", () => {
    render(<MediaForm initialType="book" />);

    expect(screen.getByLabelText("封面图片 URL")).toBeInTheDocument();
    expect(screen.getByLabelText("出版日期")).toBeInTheDocument();
    expect(screen.getByLabelText("出版社")).toBeInTheDocument();
    expect(screen.getByLabelText("ISBN")).toBeInTheDocument();
    expect(screen.getByLabelText("页数")).toBeInTheDocument();
    expect(screen.getByText("只记录总页数，不跟踪阅读进度。")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "作者" })).toBeInTheDocument();
    expect(screen.getByLabelText("类型标签")).toBeInTheDocument();
    expect(screen.getByLabelText("系列")).toBeInTheDocument();
    expect(screen.getByLabelText("地区")).toBeInTheDocument();
    expect(screen.getByLabelText("语言")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "阅读状态" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "想读" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "在读" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "读过" })).toBeInTheDocument();

    expect(screen.queryByLabelText(/译者/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/阅读进度/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/已读页/)).not.toBeInTheDocument();
  });

  it("编辑页预填图书地区与语言", () => {
    render(
      <MediaForm
        initialType="book"
        lockType
        item={{
          id: "b1",
          type: "book",
          title: "测试书",
          alternate_title: null,
          summary: null,
          cover_url: null,
          release_date: null,
          runtime: null,
          parent_id: null,
          previous_parent_id: null,
          number: null,
          disc_number: null,
          status: "want_to_watch",
          rating: null,
          genres: ["小说"],
          languages: ["汉语"],
          regions: ["中国"],
          actors: [],
          directors: [],
          artists: [],
          lyricists: [],
          composers: [],
          authors: [{ id: null, name: "作者" }],
          label: null,
          page_count: null,
          publisher: null,
          isbn: null,
        }}
      />,
    );
    expect(screen.getByText("中国")).toBeInTheDocument();
    expect(screen.getByText("汉语")).toBeInTheDocument();
  });

  it("切换阅读状态会写入隐藏 status 字段", () => {
    const { container } = render(<MediaForm initialType="book" />);
    fireEvent.click(screen.getByRole("button", { name: "在读" }));
    expect(container.querySelector('input[name="status"]')).toHaveValue("in_progress");
    fireEvent.click(screen.getByRole("button", { name: "读过" }));
    expect(container.querySelector('input[name="status"]')).toHaveValue("watched");
  });
});
