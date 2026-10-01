import ReferenceQuickEdit from "../ReferenceQuickEdit";
import StatusModal from "../../StatusModal";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ManagePagination from "../../ManagePagination";
import { requireOwner } from "@/lib/auth/server";
import { escapeLikePattern, isReferenceType, nameOrAliasFilter, referenceTypes } from "@/lib/admin/catalog";

const PAGE_SIZE = 25;

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
    <div className="surface-panel mb-8 rounded-3xl p-5 sm:p-8 flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="admin-heading">{config.label}</h1><p className="mt-2 text-neutral-400">共 <span className="font-mono">{(count ?? 0).toLocaleString("en-US")}</span> 项资料 · 集中维护，关联作品同步更新</p></div>
      {quick ? <ReferenceQuickEdit kind={kind} /> : <Link className="admin-button admin-primary shrink-0" href={`/manage/references/${kind}/new`}>新增{config.label}</Link>}
    </div>
    {search.deleted && <StatusModal key={search.n} message="资料及其关联已删除，影视作品已保留。" />}
    <form className="surface-panel mb-6 rounded-2xl p-4 sm:p-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3"><label>{config.alternate ? "搜索名称或别名" : "搜索名称"}<input name="q" defaultValue={q} maxLength={200} placeholder={config.alternate ? `搜索${config.label}名称或别名` : `搜索${config.label}`} /></label><button type="submit">搜索</button></form>
    {/* 类型、地区、语言名称短，用卡片网格一屏看更多；人物与系列保留列表，显示别名。 */}
    {quick ? <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map(/* 引用计数来自嵌入聚合，不拉取全部作品。 */ row => {
      const links = (row[config.link] as { count: number }[])?.[0]?.count ?? 0;
      return <li key={row.id} className="surface-panel flex items-center gap-3 rounded-2xl py-3.5 pl-5 pr-3.5">
        <Link href={`/manage/references/${kind}/${row.id}`} className="group min-w-0 flex-1"><h2 className="break-words font-medium text-white transition-colors group-hover:text-[var(--accent-hover)]">{row.name}</h2><p className="mt-0.5 font-mono text-xs text-neutral-400">{links.toLocaleString("en-US")} 个关联 →</p></Link>
        <ReferenceQuickEdit kind={kind} item={{ id: row.id, name: row.name }} count={links} />
      </li>;
    })}</ul> : <ul className="surface-panel divide-y divide-white/10 overflow-hidden rounded-2xl">{rows.map(/* 引用计数来自嵌入聚合，不拉取全部作品。 */ row => <li key={row.id}><Link href={`/manage/references/${kind}/${row.id}`} className="group flex min-w-0 items-center justify-between gap-4 p-5 transition-colors hover:bg-white/5 sm:px-6"><div className="min-w-0"><h2 className="break-words font-medium text-white transition-colors group-hover:text-[var(--accent-hover)]">{row.name}</h2>{row.alternate_name ? <p className="mt-1 break-words text-sm text-neutral-400">{row.alternate_name}</p> : kind === "people" && <p className="mt-1.5"><span className="surface-muted rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-neutral-300">未填别名</span></p>}</div><span className="shrink-0 font-mono text-sm text-neutral-400">{((row[config.link] as { count: number }[])?.[0]?.count ?? 0).toLocaleString("en-US")} 个关联 →</span></Link></li>)}</ul>}
    {!rows.length && <div className="surface-panel rounded-2xl p-12 text-center"><p className="text-neutral-400">{q ? `没有匹配的资料，试试其他名称${config.alternate ? "或别名" : ""}。` : `还没有${config.label}，从第一项资料开始。`}</p></div>}
    <ManagePagination page={page} totalPages={totalPages} params={{ q }} basePath={`/manage/references/${kind}`} label="资料列表分页" />
  </section>;
}
