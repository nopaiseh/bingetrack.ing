import ReferenceQuickEdit from "../ReferenceQuickEdit";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/server";
import { isReferenceType, referenceTypes } from "@/lib/admin/catalog";

/** 分页显示关联资料及引用数，空列表也保留新增入口。 */
export default async function ReferenceList({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ q?: string; page?: string; deleted?: string }> }) {
  const { db } = await requireOwner();
  const { kind } = await params;
  if (!isReferenceType(kind)) notFound();
  const config = referenceTypes[kind];
  const search = await searchParams;
  const q = (search.q ?? "").slice(0, 200);
  const page = Math.min(100000, Math.max(1, parseInt(search.page ?? "1", 10) || 1));
  const { data, count, error } = await db.from(config.table).select(`id,name,${config.alternate ? "alternate_name," : ""}${config.link}(count)`, { count: "exact" }).ilike("name", `%${q}%`).order("name").order("id").range((page - 1) * 25, page * 25 - 1);
  if (error) throw new Error("无法读取关联资料，请重试。");
  const rows = data as unknown as { id: string; name: string; alternate_name?: string; [key: string]: unknown }[];
  return <section>
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 text-sm text-neutral-400">关联资料</p><h1 className="admin-heading">{config.label}</h1><p className="mt-3 text-sm text-neutral-400">{count ?? 0} 项资料 · 集中维护，关联作品同步更新</p></div>{kind === "genres" || kind === "regions" || kind === "languages" ? <ReferenceQuickEdit kind={kind} /> : <Link className="admin-button admin-primary" href={`/manage/references/${kind}/new`}>新增{config.label}</Link>}</header>
    {search.deleted && <p role="status" className="mb-5 text-green-300">资料及其关联已删除，影视作品已保留。</p>}
    <form className="mb-6 flex items-end gap-3"><label className="flex-1">搜索名称<input name="q" defaultValue={q} maxLength={200} placeholder={`搜索${config.label}`} /></label><button>搜索</button></form>
    <ul className="surface-panel divide-y divide-white/10 overflow-hidden rounded-2xl">{rows.map(/* 引用计数来自嵌入聚合，不拉取全部作品。 */ row => <li key={row.id} className="flex items-center gap-3 pr-5"><Link href={`/manage/references/${kind}/${row.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-4 p-5 transition-colors hover:bg-white/5"><div className="min-w-0"><h2 className="break-words font-medium text-white">{row.name}</h2>{row.alternate_name && <p className="mt-1 break-words text-sm text-neutral-400">{row.alternate_name}</p>}</div><span className="shrink-0 text-sm text-neutral-400">{(row[config.link] as { count: number }[])?.[0]?.count ?? 0} 个关联 →</span></Link>{(kind === "genres" || kind === "regions" || kind === "languages") && <ReferenceQuickEdit kind={kind} item={{ id: row.id, name: row.name }} count={(row[config.link] as { count: number }[])?.[0]?.count ?? 0} />}</li>)}</ul>
    {!rows.length && <div className="surface-panel rounded-2xl p-12 text-center"><p className="text-neutral-400">{q ? "没有匹配的资料，试试其他名称。" : `还没有${config.label}，从第一项资料开始。`}</p></div>}
    <nav aria-label="资料列表分页" className="mt-6 flex items-center justify-between">{page > 1 ? <Link href={`?${new URLSearchParams({ q, page: String(page - 1) })}`}>上一页</Link> : <span />}<span className="text-sm text-neutral-400">第 {page} 页</span>{page * 25 < (count ?? 0) ? <Link href={`?${new URLSearchParams({ q, page: String(page + 1) })}`}>下一页</Link> : <span />}</nav>
  </section>;
}
