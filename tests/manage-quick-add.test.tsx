import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import QuickAddDialog from "@/app/(admin)/manage/media/series/QuickAddDialog";
import type { SeriesStructure } from "@/lib/admin/series-structure";

vi.mock("@/app/(admin)/manage/actions", () => ({ saveMedia: vi.fn() }));

beforeAll(() => {
  // jsdom 未实现模态对话框，只需把它标记为打开。
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
});

const structure: SeriesStructure = {
  show: { id: "show", title: "人生切割术", alternateTitle: null, coverUrl: null, status: "watching", rating: 9.1 },
  seasons: [{ id: "s2", number: 2, title: "第 2 季", episodeCount: 7, status: "watching" }],
  expandedSeasonId: "s2",
  episodes: [],
  totalEpisodes: 7,
  nextSeasonNumber: 3,
  nextEpisode: { number: 8, releaseDate: "2025-03-07", runtime: 52, afterTitle: "Chikhai Bardo" },
};

describe("快速新增弹窗", () => {
  it("编号字段的名称不含输入框两侧的「第」「集」，预填下一集编号、日期与时长", () => {
    render(<QuickAddDialog kind="episode" structure={structure} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "新增单集" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText("集编号", { exact: true })).toHaveValue(8);
    expect(screen.getByLabelText("发行日期")).toHaveValue("2025-03-07");
    expect(screen.getByLabelText("时长（分钟）")).toHaveValue(52);
    expect(screen.getByText(/接在「Chikhai Bardo」之后/)).toBeInTheDocument();
  });

  it("新增季时预填下一季编号与标题，上级为电视节目", () => {
    const { container } = render(<QuickAddDialog kind="season" structure={structure} onClose={vi.fn()} />);
    expect(screen.getByLabelText("季编号（特别篇可填 0）", { exact: true })).toHaveValue(3);
    expect(screen.getByLabelText("标题")).toHaveValue("第 3 季");
    expect(container.querySelector('input[name="parent_id"]')).toHaveValue("show");
  });
});
