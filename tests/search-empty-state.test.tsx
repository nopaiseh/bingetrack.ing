import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SearchEmptyState from "@/components/search/SearchEmptyState";

describe("SearchEmptyState", () => {
  it("有关键词时说明文案提到关键词，并用 status 角色宣告", () => {
    render(<SearchEmptyState query="星际" canReset={false} onReset={vi.fn()} onSuggest={vi.fn()} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("没有匹配的作品")).toBeInTheDocument();
    expect(
      screen.getByText("没有与这个关键词匹配的电影、电视节目、音乐、图书或人物。可以换一个词，或清除目前的筛选后再试。"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "清除筛选" })).not.toBeInTheDocument();
  });

  it("无关键词时提示放宽筛选，并在 canReset 时提供清除按钮", () => {
    const onReset = vi.fn();
    render(<SearchEmptyState query="" canReset onReset={onReset} onSuggest={vi.fn()} />);

    expect(
      screen.getByText(
        "没有作品符合当前筛选。可搜索电影、电视节目、音乐或图书；也可以放宽条件，或从下面的方向开始。",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("四个起步方向按钮分别建议对应筛选", () => {
    const onSuggest = vi.fn();
    render(<SearchEmptyState query="" canReset={false} onReset={vi.fn()} onSuggest={onSuggest} />);

    expect(screen.getByText("试试这些")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "电影" }));
    fireEvent.click(screen.getByRole("button", { name: "电视节目" }));
    fireEvent.click(screen.getByRole("button", { name: "音乐" }));
    fireEvent.click(screen.getByRole("button", { name: "即将上映" }));

    expect(onSuggest).toHaveBeenNthCalledWith(1, { type: ["movie"] });
    expect(onSuggest).toHaveBeenNthCalledWith(2, { type: ["tv_show"] });
    expect(onSuggest).toHaveBeenNthCalledWith(3, { type: ["album"] });
    expect(onSuggest).toHaveBeenNthCalledWith(4, { status: ["upcoming"] });
  });
});
