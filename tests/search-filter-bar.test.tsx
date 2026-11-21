import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActiveFilterBar from "@/components/search/ActiveFilterBar";
import SearchFilterPanel from "@/components/search/SearchFilterPanel";
import { EMPTY_FILTERS } from "@/components/search/search-model";
import type { SearchFilters } from "@/lib/api/search-state";

function renderPanel(filters: SearchFilters = EMPTY_FILTERS, advancedVisible = false) {
  const setFilters = vi.fn();
  render(
    <SearchFilterPanel
      filters={filters}
      setFilters={setFilters}
      advancedVisible={advancedVisible}
      genreOptions={["剧情"]}
      regionOptions={["日本"]}
      languageOptions={["日语"]}
      yearOptions={["2020", "2024"]}
      panelRef={createRef()}
    />,
  );
  return setFilters;
}

describe("SearchFilterPanel", () => {
  it("shows the primary filters and hides advanced fields until asked", () => {
    renderPanel();
    expect(screen.getByText("分类")).toBeInTheDocument();
    expect(screen.getByText("状态")).toBeInTheDocument();
    expect(screen.getByText("排序")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "电影" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "专辑" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "音乐" })).not.toBeInTheDocument();
    const typeRow = screen.getByText("分类").parentElement;
    expect(typeRow).not.toBeNull();
    const typeLabels = Array.from(typeRow!.querySelectorAll("button")).map((button) => button.textContent?.trim());
    expect(typeLabels).toEqual(["全部", "电影", "电视节目", "专辑", "单曲", "图书", "系列", "导演", "演员"]);
    expect(screen.getByRole("button", { name: "日期，降序" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("combobox", { name: "开始年份" })).not.toBeInTheDocument();
    const collapsed = document.getElementById("search-filters");
    expect(collapsed).not.toBeNull();
    expect(collapsed).toHaveAttribute("hidden");
    expect(collapsed).toHaveClass("hidden");
    expect(collapsed).not.toHaveClass("flex");
  });

  it("keeps search-filters mounted when advanced filters are visible", () => {
    renderPanel(EMPTY_FILTERS, true);
    const panel = document.getElementById("search-filters");
    expect(panel).not.toBeNull();
    expect(panel).not.toHaveAttribute("hidden");
    expect(panel).toHaveClass("flex");
    expect(panel).not.toHaveClass("hidden");
    expect(screen.getByRole("combobox", { name: "开始年份" })).toBeInTheDocument();
  });

  it("toggles a type, reverses the sort, and reveals the year range", () => {
    const setFilters = renderPanel(EMPTY_FILTERS, true);
    fireEvent.click(screen.getByRole("button", { name: "电影" }));
    const toggle = setFilters.mock.calls[0][0] as (previous: SearchFilters) => SearchFilters;
    expect(toggle(EMPTY_FILTERS).type).toEqual(["movie"]);

    fireEvent.click(screen.getByRole("button", { name: "日期，降序" }));
    const sort = setFilters.mock.calls[1][0] as (previous: SearchFilters) => SearchFilters;
    expect(sort(EMPTY_FILTERS).sort).toEqual(["date_asc"]);

    expect(screen.getByRole("combobox", { name: "开始年份" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "结束年份" })).toBeInTheDocument();
  });
});

describe("ActiveFilterBar", () => {
  it("clears filters with the shared empty object and keeps the current sort", () => {
    const setFilters = vi.fn();
    const filters = { ...EMPTY_FILTERS, type: ["movie"], sort: ["rating_desc"] };
    render(
      <ActiveFilterBar
        filters={filters}
        setFilters={setFilters}
        genreOptions={[]}
        regionOptions={[]}
        languageOptions={[]}
      />,
    );

    expect(screen.getByText("已选条件:")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "清空筛选" }));
    expect(setFilters).toHaveBeenCalledWith({ ...EMPTY_FILTERS, sort: ["rating_desc"] });
  });

  it("renders nothing extra when every list is empty", () => {
    const { container } = render(
      <ActiveFilterBar
        filters={EMPTY_FILTERS}
        setFilters={vi.fn()}
        genreOptions={[]}
        regionOptions={[]}
        languageOptions={[]}
      />,
    );
    expect(screen.getByText("已选条件:")).toBeInTheDocument();
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });
});
