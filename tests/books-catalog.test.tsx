import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BooksCatalog from "@/app/books/BooksCatalog";
import type { MediaCard } from "@/lib/types";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/books",
  useRouter: () => ({ push: vi.fn() }),
}));

function card(partial: Partial<MediaCard> & Pick<MediaCard, "id" | "title">): MediaCard {
  return {
    date: "2024-01-01",
    release_year: 2024,
    rating: null,
    genres: [],
    languages: [],
    cover_url: "",
    type: "books",
    dbType: "book",
    status: "want_to_watch",
    ...partial,
  };
}

describe("BooksCatalog", () => {
  const reading = [card({ id: "r1", title: "在读书", status: "in_progress" })];
  const read = [card({ id: "d1", title: "读过书", status: "watched" })];
  const want = [card({ id: "w1", title: "想读书", status: "want_to_watch" })];

  it("渲染统计卡与三个分区，无筛选标签", () => {
    render(
      <BooksCatalog reading={reading} read={read} want={want} stats={{ total: 3, reading: 1, read: 1, want: 1 }} />,
    );

    expect(screen.getByRole("heading", { name: "图书", hidden: true })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /图书总数量/ })).toHaveAttribute("href", "/search?type=book");
    expect(screen.getByRole("link", { name: /读过的书/ })).toHaveAttribute("href", "/search?type=book&status=watched");
    expect(screen.getByRole("link", { name: /在读的书/ })).toHaveAttribute(
      "href",
      "/search?type=book&status=in_progress",
    );
    expect(screen.getByRole("link", { name: /想读的书/ })).toHaveAttribute(
      "href",
      "/search?type=book&status=want_to_watch",
    );

    expect(screen.queryByRole("tablist", { name: "阅读状态筛选" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "在读" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "我已读" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "我想读" })).toBeInTheDocument();
    expect(screen.getByText("在读书")).toBeInTheDocument();
    expect(screen.getByText("读过书")).toBeInTheDocument();
    expect(screen.getByText("想读书")).toBeInTheDocument();

    expect(screen.getAllByRole("link", { name: /查看全部/ }).map((link) => link.getAttribute("href"))).toEqual([
      "/search?type=book&status=in_progress",
      "/search?type=book&status=watched",
      "/search?type=book&status=want_to_watch",
    ]);
  });

  it("空分区不渲染，空目录显示空状态", () => {
    const { rerender } = render(
      <BooksCatalog reading={reading} read={[]} want={[]} stats={{ total: 1, reading: 1, read: 0, want: 0 }} />,
    );

    expect(screen.getByRole("heading", { name: "在读" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "我已读" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "我想读" })).not.toBeInTheDocument();

    rerender(<BooksCatalog reading={[]} read={[]} want={[]} stats={{ total: 0, reading: 0, read: 0, want: 0 }} />);
    expect(screen.getByRole("heading", { name: "还没有图书" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去搜索" })).toHaveAttribute("href", "/search?type=book");
  });

  it("无封面时用书名首字块", () => {
    const { container } = render(
      <BooksCatalog reading={reading} read={[]} want={[]} stats={{ total: 1, reading: 1, read: 0, want: 0 }} />,
    );
    expect(container.querySelector("[data-initial]")).toBeTruthy();
  });
});
