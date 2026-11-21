import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

import MediaBackLink, { DefaultMediaBackLink, BackLink } from "@/components/MediaBackLink";

describe("MediaBackLink from 参数校验", () => {
  it.each(["/search", "/search?type=movie", "/search?q=%E7%94%B5%E5%BD%B1&type=album"])(
    "合法搜索页路径 %s 用作返回地址，文案为返回搜索页",
    (from) => {
      navigation.search = `?from=${encodeURIComponent(from)}`;
      render(<MediaBackLink type="movies" />);
      const link = screen.getByRole("link", { name: /返回搜索页/ });
      expect(link).toHaveAttribute("href", from);
    },
  );

  it.each([
    ["外部绝对地址", "https://evil.example/search"],
    ["协议相对地址", "//evil.example/search"],
    ["站内非搜索路径", "/movies"],
    ["搜索路径伪装前缀", "/searching"],
    ["javascript 伪协议", "javascript:alert(1)"],
    ["空字符串", ""],
  ])("非法或外部 from（%s）回退到默认目录链接", (_label, from) => {
    navigation.search = from === "" ? "?from=" : `?from=${encodeURIComponent(from)}`;
    render(<MediaBackLink type="albums" />);
    const link = screen.getByRole("link", { name: /返回音乐列表/ });
    expect(link).toHaveAttribute("href", "/albums");
    expect(screen.queryByRole("link", { name: /返回搜索页/ })).not.toBeInTheDocument();
  });

  it("缺少 from 时按类型回退默认列表", () => {
    navigation.search = "";
    render(<MediaBackLink type="shows" />);
    expect(screen.getByRole("link", { name: /返回电视节目列表/ })).toHaveAttribute("href", "/shows");
  });
});

describe("DefaultMediaBackLink / BackLink", () => {
  it("按公开类型生成返回列表文案与 href", () => {
    render(<DefaultMediaBackLink type="books" />);
    expect(screen.getByRole("link", { name: /返回图书列表/ })).toHaveAttribute("href", "/books");
  });

  it("BackLink 渲染传入的 href 与标签", () => {
    render(<BackLink href="/search?q=a" label="自定义返回" />);
    expect(screen.getByRole("link", { name: /自定义返回/ })).toHaveAttribute("href", "/search?q=a");
  });
});
