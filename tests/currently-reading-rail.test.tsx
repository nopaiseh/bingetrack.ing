import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CurrentlyReadingRail, {
  currentlyReadingAuthorsLine,
  currentlyReadingTitle,
} from "@/components/CurrentlyReadingRail";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

describe("CurrentlyReadingRail", () => {
  it("空列表不渲染", () => {
    const { container } = render(<CurrentlyReadingRail items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("渲染在读标题、书名与作者，不显示进度条", () => {
    render(
      <CurrentlyReadingRail
        items={[
          {
            bookId: "b1",
            title: "在读的书",
            posterPath: null,
            href: "/books/b1",
            authors: ["作者一", "作者二"],
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "在读" })).toBeInTheDocument();
    expect(screen.getByText("在读的书")).toBeInTheDocument();
    expect(screen.getByText("作者一、作者二")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("辅助函数处理空白标题与作者", () => {
    expect(currentlyReadingTitle("  ")).toBe("未命名图书");
    expect(currentlyReadingAuthorsLine(["", " 甲 "])).toBe("甲");
    expect(currentlyReadingAuthorsLine([])).toBeNull();
  });
});
