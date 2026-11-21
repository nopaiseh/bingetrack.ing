import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SearchScrollTop from "@/components/search/SearchScrollTop";

describe("SearchScrollTop", () => {
  it("可见时可用，点击触发回到顶部回调", () => {
    const onClick = vi.fn();
    render(<SearchScrollTop visible onClick={onClick} />);

    const button = screen.getByRole("button", { name: "返回页面顶部" });
    expect(button).not.toHaveAttribute("inert");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("隐藏时带 inert，仍保留无障碍名称但不进入交互", () => {
    const onClick = vi.fn();
    render(<SearchScrollTop visible={false} onClick={onClick} />);

    const button = screen.getByLabelText("返回页面顶部", { selector: "button" });
    expect(button).toHaveAttribute("inert");
  });
});
