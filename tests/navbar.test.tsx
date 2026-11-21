import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import Navbar from "@/components/Navbar";

const push = vi.fn();
const auth = vi.hoisted(() => ({ signedIn: false, owner: false, busy: false, error: "", signIn: vi.fn() }));
const navigation = vi.hoisted(() => ({ pathname: "/movies" }));
vi.mock("@/lib/auth/use-navbar-auth", () => ({ useNavbarAuth: () => auth }));

vi.mock(
  "next/navigation",
  /* 模拟电影路由和可记录跳转的 Next.js 导航模块。 */ () => ({
    usePathname: /* 返回当前测试设定的栏目路径。 */ () => navigation.pathname,
    useRouter: /* 返回带跳转监视函数的路由器替身。 */ () => ({ push }),
  }),
);

// next/link 不会把 prefetch 写到 DOM 上，测试替身用 data-prefetch 露出这个属性。
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children?: ReactNode;
    prefetch?: boolean | "auto" | null;
  }) => (
    <a href={href} data-prefetch={prefetch === false ? "false" : undefined} {...props}>
      {children}
    </a>
  ),
}));

beforeEach(
  /* 在每个导航测试前清空跳转记录并回到电影栏目。 */ () => {
    push.mockClear();
    navigation.pathname = "/movies";
    auth.signedIn = false;
    auth.owner = false;
    auth.signIn.mockClear();
  },
);

test(
  "marks the current section without a collapsible menu",
  /* 验证当前栏目标记，且顶部不再提供折叠菜单。 */ () => {
    render(<Navbar />);

    const movieLink = screen.getByRole("link", { name: "电影" });
    expect(movieLink).toHaveClass("text-[var(--accent)]");
    expect(movieLink).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "音乐" })).toHaveAttribute("href", "/albums");
    expect(screen.getByRole("link", { name: "图书" })).toHaveAttribute("href", "/books");
    expect(screen.queryByRole("link", { name: "专辑" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "打开导航菜单" })).not.toBeInTheDocument();
    expect(document.querySelector("#mobile-navigation")).toBeNull();
  },
);

test("导航链接与按钮统一使用 focus-ring", () => {
  auth.signedIn = true;
  auth.owner = true;
  render(<Navbar />);

  expect(screen.getByRole("link", { name: /bingetrack/ })).toHaveClass("focus-ring");
  for (const name of ["首页", "电影", "电视节目", "音乐", "图书"]) {
    expect(screen.getByRole("link", { name })).toHaveClass("focus-ring");
  }
  expect(screen.getByRole("button", { name: "搜索" })).toHaveClass("focus-ring");
  expect(screen.getByRole("button", { name: "退出" })).toHaveClass("focus-ring");
  expect(screen.getByRole("button", { name: "退出" })).toHaveClass("tap-target-expand");
  for (const link of screen.getAllByRole("link", { name: "管理" })) {
    expect(link).toHaveClass("focus-ring");
  }
  // 手机顶栏管理图标入口带隐形热区类（桌面文字链路由 md:hidden 隐藏，但 DOM 仍在）。
  const manageIcon = screen.getAllByRole("link", { name: "管理" }).find((link) => link.className.includes("size-9"));
  expect(manageIcon).toBeTruthy();
  expect(manageIcon).toHaveClass("tap-target-expand");
});

test(
  "submits trimmed desktop search text to the search route",
  /* 验证桌面搜索修剪输入空白并跳转到正确编码的搜索地址。 */ async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    const searchInputs = screen.getAllByPlaceholderText("搜索");
    await user.type(searchInputs[0], "  沙丘  ");
    await user.click(screen.getAllByRole("button", { name: "搜索" })[0]);

    expect(push).toHaveBeenCalledWith("/search?q=%E6%B2%99%E4%B8%98");
  },
);

test("手机端顶部不再重复搜索入口，由底部标签栏承担", () => {
  render(<Navbar />);
  expect(screen.queryByRole("link", { name: "搜索影视" })).not.toBeInTheDocument();
  expect(screen.getAllByPlaceholderText("搜索")).toHaveLength(1);
});

test("renders ⌘K shortcut hint badge on desktop search form", () => {
  render(<Navbar />);
  expect(screen.getByText("⌘K")).toBeInTheDocument();
});

test("focuses desktop search input when Cmd+K or / is pressed", async () => {
  const user = userEvent.setup();
  // Ensure desktop viewport width
  window.innerWidth = 1024;
  render(<Navbar />);

  const desktopInput = screen.getAllByPlaceholderText("搜索")[0];
  expect(desktopInput).not.toHaveFocus();

  // Press '/'
  await user.keyboard("/");
  expect(desktopInput).toHaveFocus();

  // Blur and test Cmd+K
  (desktopInput as HTMLInputElement).blur();
  expect(desktopInput).not.toHaveFocus();

  await user.keyboard("{Meta>}k{/Meta}");
  expect(desktopInput).toHaveFocus();
});

test("搜索页不重复显示导航栏搜索框，快捷键改为聚焦页内输入", async () => {
  navigation.pathname = "/search";
  window.innerWidth = 1280;
  const user = userEvent.setup();
  const focused = vi.fn();
  window.addEventListener("bingetrack:focus-search", focused);
  try {
    render(<Navbar />);
    expect(screen.queryByPlaceholderText("搜索")).not.toBeInTheDocument();
    expect(screen.queryByText("⌘K")).not.toBeInTheDocument();
    await user.keyboard("{Meta>}k{/Meta}");
    expect(push).not.toHaveBeenCalled();
    expect(focused).toHaveBeenCalledOnce();
  } finally {
    window.removeEventListener("bingetrack:focus-search", focused);
  }
});

test("navigates to /search when shortcut is triggered on mobile viewport", async () => {
  const user = userEvent.setup();
  window.innerWidth = 375;
  render(<Navbar />);

  await user.keyboard("{Meta>}k{/Meta}");
  expect(push).toHaveBeenCalledWith("/search");
});

test("导航栏直接登录，站长登录后展示管理和退出，不展示设置", async () => {
  const user = userEvent.setup();
  const { rerender } = render(<Navbar />);
  await user.click(screen.getByRole("button", { name: "登录" }));
  expect(auth.signIn).toHaveBeenCalledOnce();
  auth.signedIn = true;
  auth.owner = true;
  rerender(<Navbar />);
  expect(screen.queryByRole("button", { name: "登录" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "退出" })).toBeInTheDocument();
  // 桌面栏目链接与手机端顶部管理快捷入口各一个。
  const manageLinks = screen.getAllByRole("link", { name: "管理" });
  expect(manageLinks).toHaveLength(2);
  for (const link of manageLinks) expect(link).toHaveAttribute("href", "/manage");
  expect(screen.queryByRole("link", { name: "设置" })).not.toBeInTheDocument();
});

test("桌面栏目和手机图标两处管理链接都关闭预取", () => {
  auth.signedIn = true;
  auth.owner = true;
  render(<Navbar />);

  const manageLinks = screen.getAllByRole("link", { name: "管理" });
  const desktop = manageLinks.find((link) => link.textContent === "管理");
  const mobile = manageLinks.find((link) => link.classList.contains("md:hidden"));
  expect(desktop).toBeTruthy();
  expect(mobile).toBeTruthy();
  expect(desktop).not.toBe(mobile);
  for (const link of [desktop, mobile]) {
    expect(link).toHaveAttribute("href", "/manage");
    expect(link).toHaveAttribute("data-prefetch", "false");
  }
  for (const name of ["首页", "电影", "电视节目"]) {
    expect(screen.getByRole("link", { name })).not.toHaveAttribute("data-prefetch");
  }
});
