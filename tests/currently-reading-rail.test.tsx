import { fireEvent, render, screen } from "@testing-library/react";
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

const item = {
  bookId: "b1",
  title: "在读的书",
  posterPath: null as string | null,
  href: "/books/b1",
  authors: ["作者一", "作者二"],
};

describe("CurrentlyReadingRail", () => {
  it("空列表不渲染", () => {
    const { container } = render(<CurrentlyReadingRail items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("渲染在读标题、书名与作者，不显示进度条", () => {
    render(<CurrentlyReadingRail items={[item]} />);
    expect(screen.getByRole("heading", { name: "在读" })).toBeInTheDocument();
    expect(screen.getByText("在读的书")).toBeInTheDocument();
    expect(screen.getByText("作者一、作者二")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("有封面时渲染装饰性图片，无作者时不写作者行", () => {
    render(<CurrentlyReadingRail items={[{ ...item, posterPath: "/poster.jpg", authors: [], title: "  " }]} />);
    const link = screen.getByRole("link", { name: /未命名图书/ });
    const poster = link.querySelector("img");
    expect(poster).toHaveAttribute("alt", "");
    expect(screen.queryByRole("img", { name: "未命名图书" })).not.toBeInTheDocument();
    expect(screen.queryByText("作者一、作者二")).not.toBeInTheDocument();
  });

  it("滚动按钮与方向键可触发滚动", () => {
    const scrollBy = vi.fn();
    const descriptors = {
      scrollWidth: Object.getOwnPropertyDescriptor(Element.prototype, "scrollWidth"),
      clientWidth: Object.getOwnPropertyDescriptor(Element.prototype, "clientWidth"),
    };
    Object.defineProperty(Element.prototype, "scrollWidth", { configurable: true, get: () => 900 });
    Object.defineProperty(Element.prototype, "clientWidth", { configurable: true, get: () => 300 });
    Object.defineProperty(HTMLElement.prototype, "scrollBy", {
      configurable: true,
      value: scrollBy,
    });
    try {
      render(<CurrentlyReadingRail items={[item, { ...item, bookId: "b2", title: "第二本" }]} />);
      fireEvent.click(screen.getByRole("button", { name: "向右滚动 在读" }));
      fireEvent.click(screen.getByRole("button", { name: "向左滚动 在读", hidden: true }));
      const scroller = screen.getByLabelText("在读列表");
      fireEvent.keyDown(scroller, { key: "ArrowRight" });
      fireEvent.keyDown(scroller, { key: "ArrowLeft" });
      fireEvent.keyDown(scroller, { key: "Enter" });
      expect(scrollBy.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByRole("link", { name: /在读的书/ }).className).toContain("w-40");
    } finally {
      if (descriptors.scrollWidth) Object.defineProperty(Element.prototype, "scrollWidth", descriptors.scrollWidth);
      if (descriptors.clientWidth) Object.defineProperty(Element.prototype, "clientWidth", descriptors.clientWidth);
    }
  });

  it("辅助函数处理空白标题与作者", () => {
    expect(currentlyReadingTitle("  ")).toBe("未命名图书");
    expect(currentlyReadingAuthorsLine(["", " 甲 "])).toBe("甲");
    expect(currentlyReadingAuthorsLine([])).toBeNull();
  });
});
