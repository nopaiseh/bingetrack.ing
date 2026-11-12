import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import ReportsBoard from "@/app/(admin)/manage/reports/ReportsBoard";
import { clearedHint, formatReportCount, partitionReports, previewCopy } from "@/app/(admin)/manage/reports/board";
import { reports, type ReportKind, type ReportRow } from "@/lib/admin/reports";
import type { ReportCardModel } from "@/app/(admin)/manage/reports/board";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));

function row(partial: Partial<ReportRow> & Pick<ReportRow, "title" | "link_type">): ReportRow {
  return { id: partial.id ?? "row", link_id: partial.link_id ?? "id", detail: partial.detail ?? null, tags: partial.tags ?? null, weight: 0, ...partial };
}

function card(kind: ReportKind, count: number | null, previews: ReportCardModel["previews"] = []): ReportCardModel {
  const config = reports[kind];
  return {
    kind,
    label: config.label,
    description: config.description,
    href: `/manage/reports/${kind}`,
    icon: config.icon,
    unit: config.unit,
    count,
    previews,
  };
}

describe("报告分组", () => {
  it("待处理按条数排在前面，读失败优先，已清理保持原顺序", () => {
    const counts = new Map<ReportKind, number | null>([
      ["missing-alias", 0],
      ["missing-character", null],
      ["suspicious-names", 14],
      ["similar-people", 0],
      ["orphan-people", 0],
      ["credit-order", 0],
      ["incomplete-media", 2],
      ["tv-structure", 0],
      ["tracking-conflicts", 0],
      ["unused-references", 1],
    ]);
    const { pending, cleared } = partitionReports(counts);
    expect(pending).toEqual(["missing-character", "suspicious-names", "incomplete-media", "unused-references"]);
    expect(cleared[0]).toBe("missing-alias");
    expect(cleared).toContain("similar-people");
    expect(cleared).not.toContain("suspicious-names");
  });

  it("预览文案带上类型，闲置资料说明可删除或保留", () => {
    expect(previewCopy("suspicious-names", row({ link_type: "movie", title: "海王", detail: "海王 · 杰森·莫玛 饰" }))).toEqual({
      title: "海王",
      detail: "电影：海王 · 杰森·莫玛 饰",
    });
    expect(previewCopy("unused-references", row({ link_type: "genres", title: "公路片", tags: ["genres"] }))).toEqual({
      title: "类型「公路片」",
      detail: "没有作品使用，可删除或保留",
    });
    expect(previewCopy("suspicious-names", row({ link_type: "people", title: "测试  演员", tags: ["double_space"] })).detail).toBe("连续空格");
    expect(formatReportCount(null, "项")).toBe("读取失败");
    expect(formatReportCount(14, "项")).toBe("14 项");
    expect(clearedHint(["未填别名的人物", "未填角色名", "疑似重复人物", "演职员顺序异常"])).toBe("未填别名的人物、未填角色名、疑似重复人物等");
  });
});

describe("报告概览", () => {
  const pending = [
    card("suspicious-names", 14, [
      { id: "a", href: "/manage/media/a?type=movie", title: "海王", detail: "电影：海王 · 杰森·莫玛 饰" },
    ]),
    card("unused-references", 1, [
      { id: "g", href: "/manage/references/genres/g", title: "类型「公路片」", detail: "没有作品使用，可删除或保留" },
    ]),
  ];
  const cleared = [card("missing-alias", 0), card("missing-character", 0), card("similar-people", 0), card("orphan-people", 0)];

  it("待处理在前并标出数量，更多条目才出现查看全部", () => {
    render(<ReportsBoard pending={pending} cleared={cleared} />);
    const pendingHeading = screen.getByRole("heading", { name: "待处理" });
    const toggle = screen.getByRole("button", { name: /已清理 4 项/ });
    expect(pendingHeading.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: /海王/ })).toHaveAttribute("href", "/manage/media/a?type=movie");
    expect(screen.getByRole("link", { name: "查看全部 14 项" })).toHaveAttribute("href", "/manage/reports/suspicious-names");
    expect(screen.queryByRole("link", { name: "查看全部 1 项资料" })).not.toBeInTheDocument();
    expect(screen.getAllByText("14 项").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /未填别名的人物/ })).not.toBeInTheDocument();
  });

  it("已清理默认折叠，展开后仍可阅读并进入报告", async () => {
    render(<ReportsBoard pending={pending} cleared={cleared} />);
    const toggle = screen.getByRole("button", { name: /点击展开/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName(/已展开/);
    const clearedLink = screen.getByRole("link", { name: /未填别名的人物/ });
    expect(clearedLink).toHaveAttribute("href", "/manage/reports/missing-alias");
    expect(clearedLink).toHaveClass("admin-report-cleared");
    expect(clearedLink.className).not.toMatch(/opacity/);
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /未填别名的人物/ })).not.toBeInTheDocument();
  });

  it("没有待处理时说明已全部清理", () => {
    render(<ReportsBoard pending={[]} cleared={[]} />);
    expect(screen.getByText("没有需要处理的资料。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /已清理/ })).not.toBeInTheDocument();
  });
});
