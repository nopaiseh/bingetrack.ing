import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/server";
import { escapeLikePattern } from "@/lib/admin/catalog";
import { isReportKind, reportRowHref, reportRowType, reportTagLabels, reports, type ReportRow } from "@/lib/admin/reports";
import StatusModal from "../../StatusModal";
import BulkDelete from "../BulkDelete";
import SimilarPeopleReport from "../SimilarPeopleReport";
import PageHeader from "../../../PageHeader";
import AdminList from "../../list/AdminList";
import { ADMIN_LIST_PAGE_SIZE, reportBulkActions } from "../../list/model";

const PAGE_SIZE = ADMIN_LIST_PAGE_SIZE;

type QueryError = { code?: string; message?: string };

/** 偏移超过结果集时 PostgREST 返回 HTTP 416，错误码为 PGRST103。这是页码越界，不是查询失败。 */
function isRangeNotSatisfiable(error: QueryError | null, status: number) {
  return error?.code === "PGRST103" || status === 416;
}

/** 页面只抛出固定说明。code 与 message 放在 cause 上，Sentry 的链式异常才能看到真实原因。 */
function reportReadError(error: QueryError) {
  const cause = new Error(error.message ?? "");
  cause.name = error.code ?? "SupabaseError";
  return new Error("无法读取报告，请确认数据库迁移已应用后重试。", {
    cause: Object.assign(cause, { code: error.code, message: error.message ?? "" }),
  });
}

function reportPageHref(report: string, q: string, page: number) {
  return `/manage/reports/${report}?${new URLSearchParams({ q, page: String(page) })}`;
}

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
  const { data, count, error, status } = await query.order("weight", { ascending: false }).order("sort_key").order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  // 失败响应不带 count。越界时另计总数，再跳到最后一页；空结果则回到第 1 页。同一地址不能再跳，否则会循环。
  if (isRangeNotSatisfiable(error, status)) {
    let countQuery = db.from(config.view).select("id", { count: "exact", head: true });
    if (q) countQuery = countQuery.ilike("title", `%${escapeLikePattern(q)}%`);
    const counted = await countQuery;
    if (counted.error) throw reportReadError(counted.error);
    const lastPage = Math.max(1, Math.ceil((counted.count ?? 0) / PAGE_SIZE));
    if (page > lastPage) redirect(reportPageHref(report, q, lastPage));
    throw reportReadError(error ?? { code: "PGRST103", message: "Requested range not satisfiable" });
  }
  if (error) throw reportReadError(error);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  if (page > totalPages) redirect(reportPageHref(report, q, totalPages));
  const rows = (data ?? []) as ReportRow[];
  return <section>
    <PageHeader
      eyebrow={<Link href="/manage/reports" className="hover:text-fg">← 全部报告</Link>}
      title={config.label}
      description={<>{q ? `找到 ${count ?? 0} ${config.unit}` : `共 ${count ?? 0} ${config.unit}`} · {config.description}</>}
    />
    {search.deleted && <StatusModal key={search.n} message={`已删除 ${Number(search.deleted) || 0} ${config.unit}。`} />}
    <AdminList
      basePath={`/manage/reports/${report}`}
      preserved={{}}
      search={{ name: "q", label: "搜索名称", placeholder: "在报告中搜索名称或标题", value: q }}
      columns={[]}
      rows={rows.map(/* 标签优先显示问题说明，其余如演员名原样显示。 */ row => {
        const tags = (row.tags ?? []).map(tag => reportTagLabels[tag] ?? tag);
        return {
          id: row.id,
          href: reportRowHref(row),
          title: row.title,
          subtitle: [reportRowType(row.link_type), row.detail].filter(Boolean).join(" · "),
          meta: tags.length ? tags.join(" · ") : null,
          cells: [],
        };
      })}
      page={page}
      pageSize={PAGE_SIZE}
      total={count ?? 0}
      totalPages={totalPages}
      pageParams={q ? { q } : {}}
      empty={q ? "没有匹配的条目，试试其他名称。" : "没有需要处理的资料。"}
      noun={config.unit}
      listLabel={`${config.label}列表`}
      actions={reportBulkActions}
    />
    {"bulkDelete" in config && !q && !!count && <BulkDelete report={report} count={count} unit={config.unit} />}
  </section>;
}
