import { requireOwner } from "@/lib/auth/server";
import { reportRowHref, reports, type ReportKind, type ReportRow } from "@/lib/admin/reports";
import { readReportCounts } from "@/lib/admin/overview";
import PageHeader, { AdminCrumb } from "../../PageHeader";
import { partitionReports, previewCopy, REPORT_PREVIEW_LIMIT, reportCardBase, type ReportPreview } from "./board";
import ReportsBoard from "./ReportsBoard";

/** 只取每份待处理报告的前几行，供概览卡片展示；读失败时卡片仍显示数量。 */
async function readPreviews(db: Awaited<ReturnType<typeof requireOwner>>["db"], kind: ReportKind): Promise<ReportPreview[]> {
  try {
    const { data, error } = await db
      .from(reports[kind].view)
      .select("id,link_type,link_id,title,detail,tags")
      .order("weight", { ascending: false })
      .order("sort_key")
      .order("id")
      .limit(REPORT_PREVIEW_LIMIT);
    if (error || !data) return [];
    return (data as ReportRow[]).map(row => ({ id: row.id, href: reportRowHref(row), ...previewCopy(kind, row) }));
  } catch {
    return [];
  }
}

/** 报告概览：需要处理的在前，已清理的收起。 */
export default async function ReportsPage() {
  const { db } = await requireOwner();
  const counts = await readReportCounts(db);
  const { pending, cleared } = partitionReports(counts);
  const pendingCards = await Promise.all(pending.map(async kind => {
    const count = counts.get(kind) ?? null;
    return { ...reportCardBase(kind), count, previews: count ? await readPreviews(db, kind) : [] };
  }));
  const clearedCards = cleared.map(kind => ({ ...reportCardBase(kind), count: 0, previews: [] }));
  return <section>
    <PageHeader
      eyebrow={<AdminCrumb current="报告" />}
      title="数据报告"
      description="挑出缺漏、闲置与可疑的资料。未处理的在前，已清理的单独收起或弱化。"
      actions={<>
        <span className="admin-report-pill is-pending"><span className="font-mono">{pending.length}</span> 份待处理</span>
        <span className="admin-report-pill"><span className="font-mono">{cleared.length}</span> 份已清理</span>
      </>}
    />
    <ReportsBoard pending={pendingCards} cleared={clearedCards} />
  </section>;
}
