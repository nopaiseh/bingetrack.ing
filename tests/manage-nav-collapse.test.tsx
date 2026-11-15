import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminFrame from "@/app/(admin)/AdminFrame";
import ManageNav from "@/app/(admin)/manage/ManageNav";

const navigation = vi.hoisted(() => ({ pathname: "/manage", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/app/(admin)/manage/actions", () => ({ manualRevalidateCache: vi.fn() }));

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

beforeEach(() => {
  navigation.pathname = "/manage";
  navigation.search = "";
  document.cookie = "admin-nav=; max-age=0; path=/";
});

describe("管理侧栏", () => {
  it("不带类型的 /manage 高亮概览，编辑季集时高亮电视节目", () => {
    const { rerender } = render(
      <AdminFrame initialCollapsed={false} nav={<ManageNav />}>
        <p>内容</p>
      </AdminFrame>,
    );
    const nav = screen.getByRole("navigation", { name: "内容管理分类" });
    expect(within(nav).getByRole("link", { name: "概览" })).toHaveAttribute("aria-current", "page");
    navigation.pathname = "/manage/media/abc";
    navigation.search = "type=tv_episode";
    rerender(
      <AdminFrame initialCollapsed={false} nav={<ManageNav />}>
        <p>内容</p>
      </AdminFrame>,
    );
    expect(within(nav).getByRole("link", { name: "电视节目" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).queryByRole("link", { name: "单集" })).not.toBeInTheDocument();
  });

  it("收起后只留图标，名称由无障碍标签提供，偏好写入 Cookie", async () => {
    render(
      <AdminFrame initialCollapsed={false} nav={<ManageNav />}>
        <p>内容</p>
      </AdminFrame>,
    );
    await userEvent.click(screen.getByRole("button", { name: "收起侧栏" }));
    const nav = screen.getByRole("navigation", { name: "内容管理分类" });
    const movie = within(nav).getByRole("link", { name: "电影" });
    expect(movie).toHaveAttribute("title", "电影");
    expect(movie).not.toHaveTextContent("电影");
    expect(document.cookie).toContain("admin-nav=collapsed");
    await userEvent.click(screen.getByRole("button", { name: "展开侧栏" }));
    expect(document.cookie).toContain("admin-nav=expanded");
  });

  it("账号安全页高亮设置，概览不再是当前页", () => {
    navigation.pathname = "/settings";
    render(
      <AdminFrame initialCollapsed={false} nav={<ManageNav />}>
        <p>内容</p>
      </AdminFrame>,
    );
    expect(screen.getByRole("link", { name: "账号安全" })).toHaveAttribute("aria-current", "page");
    const nav = screen.getByRole("navigation", { name: "内容管理分类" });
    expect(within(nav).getByRole("link", { name: "概览" })).not.toHaveAttribute("aria-current");
  });

  it("导航和顶栏里指向 /manage 的链接关闭预取", () => {
    render(
      <AdminFrame initialCollapsed={false} nav={<ManageNav />}>
        <p>内容</p>
      </AdminFrame>,
    );
    const manageLinks = screen.getAllByRole("link").filter((link) => link.getAttribute("href") === "/manage");
    expect(manageLinks.map((link) => link.getAttribute("data-prefetch"))).toEqual(["false", "false", "false"]);
    const categories = screen.getByRole("navigation", { name: "内容管理分类" });
    expect(within(categories).getByRole("link", { name: "电影" })).not.toHaveAttribute("data-prefetch");
  });

  it("菜单按钮展开同一套导航，而不是另一份分类", async () => {
    render(
      <AdminFrame initialCollapsed={false} nav={<ManageNav />}>
        <p>内容</p>
      </AdminFrame>,
    );
    const button = screen.getByRole("button", { name: "打开管理导航" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", "admin-nav-drawer");
    expect(screen.getAllByRole("navigation", { name: "内容管理分类" })).toHaveLength(1);
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("admin-nav-drawer")).toBeInTheDocument();
    expect(screen.getAllByRole("navigation", { name: "内容管理分类" })).toHaveLength(1);
  });
});
