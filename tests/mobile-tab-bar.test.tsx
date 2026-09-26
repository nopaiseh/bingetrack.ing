import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import MobileTabBar from "@/components/MobileTabBar";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", /* 模拟可切换当前路径的 Next.js 导航模块。 */ () => ({
  usePathname: () => pathname.value,
}));

test("渲染四个主要栏目并只标记首页为当前页", () => {
  pathname.value = "/";
  render(<MobileTabBar />);

  const nav = screen.getByRole("navigation", { name: "底部导航" });
  const links = screen.getAllByRole("link");
  expect(nav).toContainElement(links[0]);
  expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/movies", "/series", "/search"]);
  expect(screen.getByRole("link", { name: "首页" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "电影" })).not.toHaveAttribute("aria-current");
});

test("详情等子路径按前缀标记所属栏目", () => {
  pathname.value = "/series/abc";
  render(<MobileTabBar />);

  expect(screen.getByRole("link", { name: "电视剧" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "首页" })).not.toHaveAttribute("aria-current");
});
