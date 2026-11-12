import ReferenceQuickEdit from "../ReferenceQuickEdit";
import StatusModal from "../../StatusModal";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/server";
import { escapeLikePattern, isReferenceType, nameOrAliasFilter, referenceTypes } from "@/lib/admin/catalog";
import PageHeader, { AdminCrumb } from "../../../PageHeader";
import AdminList from "../../list/AdminList";
import { ADMIN_LIST_PAGE_SIZE, referenceBulkActions } from "../../list/model";

const PAGE_SIZE = ADMIN_LIST_PAGE_SIZE;

/** 分页显示关联资料及引用数，空列表也保留新增入口。 */
export default async function ReferenceList({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ q?: string; page?: string; deleted?: string; n?: string }> }) {
  const { db } = await requireOwner();
  const { kind } = await params;
  if (!isReferenceType(kind)) notFound();
  const config = referenceTypes[kind];
  const search = await searchParams;
  const q = (search.q ?? "").slice(0, 200);
  const page = Math.min(100000, Math.max(1, parseInt(search.page ?? "1", 10) || 1));
  const query = db.from(config.table).select(`id,name,${config.alternate ? "alternate_name," : ""}${config.link}(count)`, { count: "exact" });
  // 有别名的资料同时按名称和别名搜索。
  const { data, count, error } = await (config.alternate ? query.or(nameOrAliasFilter(q)) : query.ilike("name", `%${escapeLikePattern(q)}%`)).order("name").order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new Error("无法读取关联资料，请重试。");
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  if (page > totalPages) redirect(`/manage/references/${kind}?${new URLSearchParams({ q, page: String(totalPages) })}`);
  const rows = data as unknown as { id: string; name: string; alternate_name?: string; [key: string]: unknown }[];
  const quick = kind === "genres" || kind === "regions" || kind === "languages";
  return <section>
    <PageHeader
      eyebrow={<AdminCrumb current={config.label} />}
      title={config.label}
      description={<>共 <span className="font-mono">{(count ?? 0).toLocaleString("en-US")}</span> 项资料 · 集中维护，关联作品同步更新</>}
      actions={quick ? <ReferenceQuickEdit kind={kind} /> : <Link className="admin-button admin-primary shrink-0" href={`/manage/references/${kind}/new`}>新增{config.label}</Link>}
    />
    {search.deleted && <StatusModal key={search.n} message="资料及其关联已删除，影视作品已保留。" />}
    <AdminList
      basePath={`/manage/references/${kind}`}
      preserved={{}}
      search={{ name: "q", label: config.alternate ? "搜索名称或别名" : "搜索名称", placeholder: config.alternate ? `搜索${config.label}名称或别名` : `搜索${config.label}`, value: q }}
      columns={[{ key: "count", label: "关联", className: "admin-col-count" }]}
      rows={rows.map(/* 引用计数来自嵌入聚合，不拉取全部作品。 */ row => {
        const links = (row[config.link] as { count: number }[])?.[0]?.count ?? 0;
        const countLabel = `${links.toLocaleString("en-US")} 个关联`;
        return {
          id: row.id,
          href: `/manage/references/${kind}/${row.id}`,
          title: row.name,
          subtitle: row.alternate_name || (kind === "people" ? "未填别名" : null),
          detail: countLabel,
          cells: [{ key: "count", label: "关联", value: countLabel }],
        };
      })}
      page={page}
      pageSize={PAGE_SIZE}
      total={count ?? 0}
      totalPages={totalPages}
      pageParams={q ? { q } : {}}
      empty={q ? `没有匹配的资料，试试其他名称${config.alternate ? "或别名" : ""}。` : `还没有${config.label}，从第一项资料开始。`}
      noun="项"
      listLabel={`${config.label}列表`}
      actions={referenceBulkActions}
    />
  </section>;
}
