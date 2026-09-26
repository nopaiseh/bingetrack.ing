import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { pageNumbers, paginationItems } from "@/lib/pagination";
import ManagePagination from "@/app/manage/ManagePagination";

test("页码窗口最多五页并在首尾处收拢", () => {
  expect(pageNumbers(1, 3)).toEqual([1, 2, 3]);
  expect(pageNumbers(1, 10)).toEqual([1, 2, 3, 4, 5]);
  expect(pageNumbers(10, 10)).toEqual([6, 7, 8, 9, 10]);
});

test("分页项补上首页、末页与省略标记", () => {
  expect(paginationItems(1, 1)).toEqual([1]);
  expect(paginationItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  expect(paginationItems(1, 12)).toEqual([1, 2, 3, 4, 5, "end-gap", 12]);
  expect(paginationItems(6, 12)).toEqual([1, "start-gap", 4, 5, 6, 7, 8, "end-gap", 12]);
  expect(paginationItems(12, 12)).toEqual([1, "start-gap", 8, 9, 10, 11, 12]);
  // 窗口紧邻首尾页时不插入多余的省略标记。
  expect(paginationItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
});

test("管理分页保留筛选条件并可直接跳到任意显示的页码", () => {
  render(<ManagePagination page={6} totalPages={12} params={{ q: "星", type: "tv_episode", parent: "" }} />);

  expect(screen.getByText("第 6 / 12 页")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "第 6 页" })).toHaveAttribute("aria-current", "page");
  const last = screen.getByRole("link", { name: "第 12 页" });
  expect(last).toHaveAttribute("href", "/manage?q=%E6%98%9F&type=tv_episode&parent=&page=12");
  expect(screen.getByRole("link", { name: "上一页" })).toHaveAttribute("href", expect.stringContaining("page=5"));
  expect(screen.getByRole("link", { name: "下一页" })).toHaveAttribute("href", expect.stringContaining("page=7"));
});

test("只有一页时不渲染分页", () => {
  const { container } = render(<ManagePagination page={1} totalPages={1} params={{ q: "", type: "movie", parent: "" }} />);
  expect(container).toBeEmptyDOMElement();
});
