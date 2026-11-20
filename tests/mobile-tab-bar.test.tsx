import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import MobileTabBar from "@/components/MobileTabBar";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock(
  "next/navigation",
  /* 模拟可切换当前路径的 Next.js 导航模块。 */ () => ({
    usePathname: () => pathname.value,
  }),
);

test("渲染六个主要栏目并只标记首页为当前页", () => {
  pathname.value = "/";
  render(<MobileTabBar />);

  const nav = screen.getByRole("navigation", { name: "底部导航" });
  expect(nav).toHaveClass("mobile-tab-bar");
  expect(document.querySelector(".mobile-tab-scrim")).toBeInTheDocument();
  const links = screen.getAllByRole("link");
  expect(nav).toContainElement(links[0]);
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "/",
    "/movies",
    "/shows",
    "/albums",
    "/books",
    "/search",
  ]);
  expect(screen.getByRole("link", { name: "首页" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "电影" })).not.toHaveAttribute("aria-current");
  expect(screen.getByRole("link", { name: "音乐" })).toHaveAttribute("href", "/albums");
  expect(screen.getByRole("link", { name: "图书" })).toHaveAttribute("href", "/books");
  expect(screen.queryByRole("link", { name: "专辑" })).not.toBeInTheDocument();
});

test("详情等子路径按前缀标记所属栏目", () => {
  pathname.value = "/shows/abc";
  render(<MobileTabBar />);

  expect(screen.getByRole("link", { name: "电视" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "首页" })).not.toHaveAttribute("aria-current");
});
