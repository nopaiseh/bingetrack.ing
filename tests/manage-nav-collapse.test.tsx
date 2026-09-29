import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

beforeEach(() => {
  navigation.pathname = "/manage";
  navigation.search = "";
  document.cookie = "admin-nav=; max-age=0; path=/";
});

describe("管理侧栏", () => {
  it("不带类型的 /manage 高亮概览，编辑季集时高亮电视节目", () => {
    const { rerender } = render(<AdminFrame initialCollapsed={false} nav={<ManageNav />}><p>内容</p></AdminFrame>);
    const nav = screen.getByRole("navigation", { name: "内容管理分类" });
    expect(within(nav).getByRole("link", { name: "概览" })).toHaveAttribute("aria-current", "page");
    navigation.pathname = "/manage/media/abc";
    navigation.search = "type=tv_episode";
    rerender(<AdminFrame initialCollapsed={false} nav={<ManageNav />}><p>内容</p></AdminFrame>);
    expect(within(nav).getByRole("link", { name: "电视节目" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).queryByRole("link", { name: "单集" })).not.toBeInTheDocument();
  });

  it("收起后只留图标，名称由无障碍标签提供，偏好写入 Cookie", async () => {
    render(<AdminFrame initialCollapsed={false} nav={<ManageNav />}><p>内容</p></AdminFrame>);
    await userEvent.click(screen.getByRole("button", { name: "收起侧栏" }));
    const nav = screen.getByRole("navigation", { name: "内容管理分类" });
    const movie = within(nav).getByRole("link", { name: "电影" });
    expect(movie).toHaveAttribute("title", "电影");
    expect(movie).not.toHaveTextContent("电影");
    expect(document.cookie).toContain("admin-nav=collapsed");
    await userEvent.click(screen.getByRole("button", { name: "展开侧栏" }));
    expect(document.cookie).toContain("admin-nav=expanded");
  });
});
