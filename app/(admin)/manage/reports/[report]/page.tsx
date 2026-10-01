import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/server";
import { escapeLikePattern } from "@/lib/admin/catalog";
import { isReportKind, reportRowHref, reportRowType, reportTagLabels, reports, type ReportRow } from "@/lib/admin/reports";
import ManagePagination from "../../ManagePagination";
import StatusModal from "../../StatusModal";
import BulkDelete from "../BulkDelete";
import SimilarPeopleReport from "../SimilarPeopleReport";

const PAGE_SIZE = 25;

/** 分页显示单份报告，每行链接到可修正该问题的编辑页。 */
export default async function ReportPage({ params, searchParams }: { params: Promise<{ report: string }>; searchParams: Promise<{ q?: string; page?: string; deleted?: string; merged?: string; dismissed?: string; n?: string }> }) {
  const { db } = await requireOwner();
  const { report } = await params;
  if (!isReportKind(report)) notFound();
  const config = reports[report];
  const search = await searchParams;
  if (report === "similar-people") return <SimilarPeopleReport db={db} merged={search.merged} dismissed={search.dismissed} nonce={search.n} />;
  const q = (search.q ?? "").slice(0, 200);
  const page = Math.min(100000, Math.max(1, Number.parseInt(search.page ?? "1", 10) || 1));
  let query = db.from(config.view).select("id,link_type,link_id,title,detail,tags,weight", { count: "exact" });
  if (q) query = query.ilike("title", `%${escapeLikePattern(q)}%`);
  const { data, count, error } = await query.order("weight", { ascending: false }).order("sort_key").order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new Error("无法读取报告，请确认数据库迁移已应用后重试。");
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  if (page > totalPages) redirect(`/manage/reports/${report}?${new URLSearchParams({ q, page: String(totalPages) })}`);
  const rows = (data ?? []) as ReportRow[];
  return <section>
    <Link href="/manage/reports" className="mb-2 inline-block text-sm text-neutral-400 hover:text-white transition-colors">← 全部报告</Link>
    <div className="surface-panel mb-8 rounded-3xl p-5 sm:p-8">
      <h1 className="admin-heading">{config.label}</h1>
      <p className="mt-2 text-neutral-400">{q ? `找到 ${count ?? 0} ${config.unit}` : `共 ${count ?? 0} ${config.unit}`} · {config.description}</p>
    </div>
    {search.deleted && <StatusModal key={search.n} message={`已删除 ${Number(search.deleted) || 0} ${config.unit}。`} />}
    <form className="surface-panel mb-6 rounded-2xl p-4 sm:p-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3"><label>搜索名称<input name="q" defaultValue={q} maxLength={200} placeholder="在报告中搜索名称或标题" /></label><button type="submit">搜索</button></form>
    {rows.length > 0 && <ul className="surface-panel divide-y divide-white/10 overflow-hidden rounded-2xl">{rows.map(/* 标签优先显示问题说明，其余如演员名原样显示。 */ row => <li key={row.id}>
      <Link href={reportRowHref(row)} className="group flex flex-col gap-3 p-5 transition-colors hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h2 className="break-words font-medium text-white transition-colors group-hover:text-[var(--accent-hover)]">{row.title}</h2>
          <p className="mt-1 break-words text-sm text-neutral-400">{[reportRowType(row.link_type), row.detail].filter(Boolean).join(" · ")}</p>
          {!!row.tags?.length && <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="问题">{row.tags.map(/* 同一行的标签不重复。 */ tag => <li key={tag} className="surface-muted rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-neutral-300">{reportTagLabels[tag] ?? tag}</li>)}</ul>}
        </div>
        <span className="shrink-0 text-sm text-neutral-400 transition-colors group-hover:text-white">去修改 →</span>
      </Link>
    </li>)}</ul>}
    {!rows.length && <div className="surface-panel rounded-2xl px-6 py-16 text-center"><span className="i-material-symbols-check-circle-outline-rounded mx-auto mb-3 block size-8 text-[var(--accent)]" aria-hidden="true" /><p className="text-neutral-400">{q ? "没有匹配的条目，试试其他名称。" : "没有需要处理的资料。"}</p></div>}
    <ManagePagination page={page} totalPages={totalPages} params={{ q }} basePath={`/manage/reports/${report}`} label="报告分页" />
    {"bulkDelete" in config && !q && !!count && <BulkDelete report={report} count={count} unit={config.unit} />}
  </section>;
}
