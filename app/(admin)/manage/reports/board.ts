import { mediaTypes } from "@/lib/admin/media-form";
import { reportGroups, reportRowType, reportTagLabels, reports, type ReportKind, type ReportRow } from "@/lib/admin/reports";

/** 待处理卡片里先展示的行数；其余从「查看全部」进入报告。 */
export const REPORT_PREVIEW_LIMIT = 5;

export type ReportPreview = { id: string; href: string; title: string; detail: string | null };

export type ReportCardModel = {
  kind: ReportKind;
  label: string;
  description: string;
  href: string;
  icon: string;
  unit: string;
  count: number | null;
  previews: ReportPreview[];
};

/** 数量为零的报告收进「已清理」；读失败和仍有条目的排在前面，条数多的更靠前。 */
export function partitionReports(counts: Map<ReportKind, number | null>) {
  const pending: ReportKind[] = [];
  const cleared: ReportKind[] = [];
  for (const kind of reportGroups().flatMap(group => group.kinds)) {
    const count = counts.get(kind) ?? null;
    if (count === 0) cleared.push(kind);
    else pending.push(kind);
  }
  pending.sort((a, b) => {
    const left = counts.get(a) ?? null;
    const right = counts.get(b) ?? null;
    if (left == null && right == null) return 0;
    if (left == null) return -1;
    if (right == null) return 1;
    return right - left;
  });
  return { pending, cleared };
}

/** 卡片标题、说明、图标与入口，数量和预览行由页面填入。 */
export function reportCardBase(kind: ReportKind): Omit<ReportCardModel, "count" | "previews"> {
  const config = reports[kind];
  return {
    kind,
    label: config.label,
    description: config.description,
    href: `/manage/reports/${kind}`,
    icon: config.icon,
    unit: config.unit,
  };
}

/** 预览行的两行文案。关联资料带上类别；影视补上「电影：」这类类型。 */
export function previewCopy(kind: ReportKind, row: ReportRow): { title: string; detail: string | null } {
  const type = reportRowType(row.link_type);
  const title = kind === "unused-references" && type ? `${type}「${row.title}」` : row.title;
  if (kind === "unused-references") return { title, detail: row.detail?.trim() || "没有作品使用，可删除或保留" };
  const detail = row.detail?.trim() ?? "";
  if (detail && Object.hasOwn(mediaTypes, row.link_type) && type) return { title, detail: `${type}：${detail}` };
  if (detail) return { title, detail };
  const tags = (row.tags ?? []).map(tag => reportTagLabels[tag] ?? tag).filter(tag => tag && tag !== type);
  if (tags.length) {
    const tagText = tags.join(" · ");
    return { title, detail: type && Object.hasOwn(mediaTypes, row.link_type) ? `${type} · ${tagText}` : tagText };
  }
  return { title, detail: type || null };
}

/** 折叠条里点出前几份已清理报告的名称。 */
export function clearedHint(labels: string[]) {
  if (!labels.length) return "";
  const shown = labels.slice(0, 3).join("、");
  return labels.length > 3 ? `${shown}等` : shown;
}

/** 数量读失败时不显示成零。 */
export function formatReportCount(count: number | null, unit: string) {
  return count == null ? "读取失败" : `${count.toLocaleString("en-US")} ${unit}`;
}
