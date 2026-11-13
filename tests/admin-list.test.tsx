import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminList from "@/app/(admin)/manage/list/AdminList";
import { ADMIN_LIST_PAGE_SIZE, LIST_TINTS, adminListHref, listInitial, listTint, mediaBulkActions } from "@/app/(admin)/manage/list/model";
import type { AdminListRow } from "@/app/(admin)/manage/list/model";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), pathname: "/manage" }));
const bulk = vi.hoisted(() => ({
  setMovieStatus: vi.fn(async () => ({ succeeded: 1, failed: 0 })),
  deleteMovies: vi.fn(async () => ({ succeeded: 1, failed: 0 })),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push, refresh: navigation.refresh }),
  usePathname: () => navigation.pathname,
}));
vi.mock("@/app/(admin)/manage/list-actions", () => ({
  setMovieStatus: bulk.setMovieStatus,
  setTvShowStatus: vi.fn(),
  deleteMovies: bulk.deleteMovies,
  deleteTvShows: vi.fn(),
  deletePeople: vi.fn(),
  listMovies: vi.fn(),
  listTvShows: vi.fn(),
  listPeople: vi.fn(),
}));

const rows: AdminListRow[] = [
  {
    id: "avengers",
    href: "/manage/media/avengers?type=movie",
    title: "复仇者联盟",
    subtitle: "Avengers",
    detail: "2026-12-18 · 2 小时 45 分钟",
    imageUrl: null,
    cells: [
      { key: "date", label: "上映", value: "2026-12-18" },
      { key: "runtime", label: "片长", value: "2 小时 45 分钟" },
    ],
    status: { label: "没看过", tone: "want" },
    trailing: { href: "/movies/avengers", label: "查看复仇者联盟的公开页面", icon: "i-material-symbols-arrow-outward-rounded" },
  },
  {
    id: "spiderman",
    href: "/manage/media/spiderman?type=movie",
    title: "蜘蛛侠",
    subtitle: null,
    detail: "2026-07-30",
    imageUrl: "https://image.tmdb.org/t/p/w185/spider.jpg",
    cells: [
      { key: "date", label: "上映", value: "2026-07-30" },
      { key: "runtime", label: "片长", value: "—" },
    ],
    status: { label: "看过", tone: "watched" },
  },
];

function renderList(search = "") {
  return render(
    <AdminList
      basePath="/manage"
      preserved={{ type: "movie" }}
      defaults={{ sort: "date" }}
      search={{ name: "q", label: "搜索标题", placeholder: "搜索标题或原名", value: search }}
      chips={{ name: "status", label: "观看状态", value: "", options: [{ value: "", label: "全部" }, { value: "watched", label: "看过" }, { value: "want_to_watch", label: "没看过" }] }}
      selects={[{ name: "sort", label: "排序", value: "date", options: [{ value: "date", label: "上映日期（新→旧）" }, { value: "title", label: "标题" }] }]}
      columns={[{ key: "date", label: "上映", className: "admin-col-date" }, { key: "runtime", label: "片长", className: "admin-col-runtime" }]}
      rows={rows}
      page={1}
      pageSize={ADMIN_LIST_PAGE_SIZE}
      total={67}
      totalPages={3}
      pageParams={{ type: "movie" }}
      empty="没有符合条件的条目。"
      noun="部"
      listLabel="电影列表"
      actions={mediaBulkActions}
      showStatus
    />,
  );
}

describe("列表地址", () => {
  it("空值和默认排序不进查询串，其余筛选可以分享", () => {
    expect(adminListHref("/manage", { type: "movie", q: "", status: "", sort: "date" }, { sort: "date" })).toBe("/manage?type=movie");
    expect(adminListHref("/manage", { type: "movie", q: "复 仇", status: "watched", sort: "title" }, { sort: "date" })).toBe("/manage?type=movie&q=%E5%A4%8D+%E4%BB%87&status=watched&sort=title");
    expect(adminListHref("/manage/references/people", { q: "万" })).toBe("/manage/references/people?q=%E4%B8%87");
  });

  it("无图色块用标题首字，白字对比度至少 4.5:1", () => {
    expect(listInitial(" 复仇者 ")).toBe("复");
    expect(listInitial("avengers")).toBe("A");
    expect(listInitial("")).toBe("·");
    for (const tint of LIST_TINTS) expect(contrast("#ffffff", tint)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#bbf7d0", "#052e16")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#fde68a", "#451a03")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#c9c0d1", "#16111b")).toBeGreaterThanOrEqual(4.5);
    expect(LIST_TINTS).toContain(listTint("复仇者联盟"));
  });
});

describe("管理列表", () => {
  afterEach(() => {
    vi.useRealTimers();
    navigation.push.mockClear();
  });

  it("搜索停顿后写入地址，下拉和状态立即生效，没有提交按钮", async () => {
    vi.useFakeTimers();
    renderList();
    expect(screen.queryByRole("button", { name: "筛选" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "搜索" })).not.toBeInTheDocument();
    expect(screen.getByText("输入即筛选，无需点「应用」")).toBeInTheDocument();

    const search = screen.getByLabelText("搜索标题");
    fireEvent.change(search, { target: { value: "复" } });
    expect(navigation.push).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(navigation.push).toHaveBeenCalledWith("/manage?type=movie&q=%E5%A4%8D", { scroll: false });

    fireEvent.change(screen.getByLabelText("排序"), { target: { value: "title" } });
    expect(navigation.push).toHaveBeenCalledWith("/manage?type=movie&q=%E5%A4%8D&sort=title", { scroll: false });

    fireEvent.click(screen.getByRole("button", { name: "看过" }));
    expect(screen.getByRole("button", { name: "看过" })).toHaveAttribute("aria-pressed", "true");
    expect(navigation.push).toHaveBeenLastCalledWith("/manage?type=movie&q=%E5%A4%8D&status=watched&sort=title", { scroll: false });
  });

  it("回车立刻搜索，后退带来的地址不会盖掉还在输入的草稿", async () => {
    vi.useFakeTimers();
    const view = renderList();
    const search = screen.getByLabelText("搜索标题");
    fireEvent.change(search, { target: { value: "蜘蛛" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(navigation.push).toHaveBeenCalledWith("/manage?type=movie&q=%E8%9C%98%E8%9B%9B", { scroll: false });

    fireEvent.change(search, { target: { value: "蜘蛛侠" } });
    view.rerender(listElement(""));
    expect(search).toHaveValue("蜘蛛侠");
    await vi.advanceTimersByTimeAsync(300);
    expect(navigation.push).toHaveBeenLastCalledWith("/manage?type=movie&q=%E8%9C%98%E8%9B%9B%E4%BE%A0", { scroll: false });
  });

  it("行链接可键盘打开，无图用首字，勾选后批量操作保持禁用并说明 Coming soon", () => {
    renderList();
    const list = screen.getByRole("list", { name: "电影列表" });
    expect(list).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Avengers/ })).toHaveAttribute("href", "/manage/media/avengers?type=movie");
    expect(screen.getByRole("link", { name: "查看复仇者联盟的公开页面" })).toHaveAttribute("href", "/movies/avengers");
    expect(screen.getByText("复")).toBeInTheDocument();
    expect(screen.getAllByText("没看过").length).toBeGreaterThan(0);
    expect(screen.getByText(/第 1–25 条，共 67 条/)).toBeInTheDocument();
    expect(screen.getByText("每页 25")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "选择 复仇者联盟" }));
    const bar = screen.getByRole("region", { name: "批量操作" });
    expect(bar).toHaveTextContent("已选 1 部");
    expect(screen.getByRole("button", { name: "已看" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "删除" })).toBeDisabled();
    expect(screen.getAllByRole("tooltip").map((tip) => tip.textContent)).toEqual(["Coming soon", "Coming soon", "Coming soon"]);

    fireEvent.click(screen.getByRole("checkbox", { name: "全选本页" }));
    expect(bar).toHaveTextContent("已选 2 部");
    fireEvent.click(screen.getByRole("button", { name: "取消选择" }));
    expect(screen.queryByRole("region", { name: "批量操作" })).not.toBeInTheDocument();
  });

  it("电影批量操作调用已看、想看和删除，删除前要确认", async () => {
    bulk.setMovieStatus.mockClear();
    bulk.deleteMovies.mockClear();
    navigation.refresh.mockClear();
    render(<AdminList {...listProps()} wired="movie" actions={[]} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "选择 复仇者联盟" }));
    fireEvent.click(screen.getByRole("button", { name: "标为已看" }));
    await waitFor(() => expect(bulk.setMovieStatus).toHaveBeenCalledWith(["avengers"], "watched"));
    expect(navigation.refresh).toHaveBeenCalled();

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    expect(bulk.deleteMovies).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    await waitFor(() => expect(bulk.deleteMovies).toHaveBeenCalledWith(["avengers"]));
    confirm.mockRestore();
  });
});

function listProps() {
  return {
    basePath: "/manage",
    preserved: { type: "movie" },
    defaults: { sort: "date" },
    search: { name: "q", label: "搜索标题", placeholder: "搜索标题或原名", value: "" },
    columns: [],
    rows,
    page: 1,
    pageSize: 25,
    total: 2,
    totalPages: 1,
    pageParams: { type: "movie" },
    empty: "没有符合条件的条目。",
    noun: "部",
    listLabel: "电影列表",
  };
}

function listElement(search: string) {
  return (
    <AdminList
      basePath="/manage"
      preserved={{ type: "movie" }}
      defaults={{ sort: "date" }}
      search={{ name: "q", label: "搜索标题", placeholder: "搜索标题或原名", value: search }}
      chips={{ name: "status", label: "观看状态", value: "", options: [{ value: "", label: "全部" }, { value: "watched", label: "看过" }] }}
      selects={[{ name: "sort", label: "排序", value: "date", options: [{ value: "date", label: "上映日期（新→旧）" }] }]}
      columns={[]}
      rows={rows}
      page={1}
      pageSize={25}
      total={2}
      totalPages={1}
      pageParams={{ type: "movie" }}
      empty="没有符合条件的条目。"
      noun="部"
      listLabel="电影列表"
      actions={mediaBulkActions}
    />
  );
}

function channel(value: number) {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const color = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((color >> 16) & 255) + 0.7152 * channel((color >> 8) & 255) + 0.0722 * channel(color & 255);
}

function contrast(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}
