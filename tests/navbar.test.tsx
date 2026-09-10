import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import Navbar from "@/components/Navbar";

const push = vi.fn();
const auth = vi.hoisted(() => ({ signedIn: false, owner: false, busy: false, error: "", signIn: vi.fn() }));
vi.mock("@/lib/auth/use-navbar-auth", () => ({ useNavbarAuth: () => auth }));

vi.mock("next/navigation", /* 模拟电影路由和可记录跳转的 Next.js 导航模块。 */ () => ({
  usePathname: /* 固定返回电影栏目路径以测试当前导航状态。 */ () => "/movies",
  useRouter: /* 返回带跳转监视函数的路由器替身。 */ () => ({ push }),
}));

beforeEach(/* 在每个导航测试前清空跳转记录。 */ () => {
  push.mockClear();
  auth.signedIn = false;
  auth.owner = false;
  auth.signIn.mockClear();
});

test("marks the current section and toggles the mobile menu", /* 验证当前栏目标记和移动菜单的开关状态。 */ async () => {
  const user = userEvent.setup();
  render(<Navbar />);

  expect(screen.getAllByRole("link", { name: "电影" })).toHaveLength(1);
  expect(document.querySelector("#mobile-navigation")).toHaveAttribute("inert");

  const menuButton = screen.getByRole("button", { name: "打开导航菜单" });
  await user.click(menuButton);
  expect(screen.getByRole("button", { name: "关闭导航菜单" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  const movieLinks = screen.getAllByRole("link", { name: "电影" });
  expect(movieLinks).toHaveLength(2);
  for (const link of movieLinks) {
    expect(link).toHaveClass("text-red-500");
    expect(link).toHaveAttribute("aria-current", "page");
  }
});

test("submits trimmed desktop search text to the search route", /* 验证桌面搜索修剪输入空白并跳转到正确编码的搜索地址。 */ async () => {
  const user = userEvent.setup();
  render(<Navbar />);

  const searchInputs = screen.getAllByPlaceholderText("搜索");
  await user.type(searchInputs[0], "  沙丘  ");
  await user.click(screen.getAllByRole("button", { name: "搜索" })[0]);

  expect(push).toHaveBeenCalledWith("/search?q=%E6%B2%99%E4%B8%98");
});


test("导航栏直接登录，站长登录后展示管理设置和退出", async () => {
  const user = userEvent.setup();
  const { rerender } = render(<Navbar />);
  await user.click(screen.getByRole("button", { name: "登录" }));
  expect(auth.signIn).toHaveBeenCalledOnce();
  auth.signedIn = true;
  auth.owner = true;
  rerender(<Navbar />);
  expect(screen.queryByRole("button", { name: "登录" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "退出" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "管理" })).toHaveAttribute("href", "/manage");
  expect(screen.getByRole("link", { name: "设置" })).toHaveAttribute("href", "/settings");
  await user.click(screen.getByRole("button", { name: "打开导航菜单" }));
  expect(screen.getAllByRole("link", { name: "设置" })).toHaveLength(2);
});
