import BackToList from "../../../BackToList";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/server";
import { isReferenceType, referenceTypes } from "@/lib/admin/catalog";
import { isMediaId } from "@/lib/functions/media-id";
import ReferenceForm from "../../ReferenceForm";
import CollectionMember from "../../CollectionMember";

/** 完整读取资料和分页关联，查询失败不得把空结果当成真实数据。 */
export default async function ReferenceDetail({ params, searchParams }: { params: Promise<{ kind: string; id: string }>; searchParams: Promise<{ saved?: string; page?: string }> }) {
  const { db } = await requireOwner();
  const { kind, id } = await params;
  if (!isReferenceType(kind) || (id !== "new" && !isMediaId(id))) notFound();
  const config = referenceTypes[kind];
  const search = await searchParams;
  if (id === "new") return <section><BackToList category={kind} /><h1 className="admin-heading my-6">新增{config.label}</h1><ReferenceForm kind={kind} /></section>;
  const page = Math.min(100000, Math.max(1, parseInt(search.page ?? "1", 10) || 1));
  const [record, relations] = await Promise.all([
    db.from(config.table).select(config.alternate ? "id,name,alternate_name" : "id,name").eq("id", id).maybeSingle(),
    db.from(config.link).select(`media_item_id,${kind === "people" ? "role," : kind === "collections" ? "position," : ""}media_items(id,title,type)`, { count: "exact" }).eq(config.key, id).order(kind === "collections" ? "position" : "media_item_id").order("media_item_id").range((page - 1) * 25, page * 25 - 1),
  ]);
  if (record.error || relations.error) throw new Error("无法完整读取资料，请重试。");
  if (!record.data) notFound();
  const item = record.data as unknown as { id: string; name: string; alternate_name?: string | null };
  const rows = relations.data as unknown as { media_item_id: string; role?: string; position?: number | null; media_items: { id: string; title: string; type: string } }[];
  return <section><BackToList category={kind} /><h1 className="admin-heading my-6 break-words">编辑：{item.name}</h1>{search.saved && <p role="status" className="mb-5 text-green-300">保存成功，关联作品已同步更新。</p>}
    <ReferenceForm key={`${id}:${item.name}:${item.alternate_name}`} kind={kind} item={item} count={relations.count ?? 0} />
    <section className="mt-10 space-y-4"><h2 className="admin-section-title text-xl font-semibold text-white">关联作品 <span className="text-sm font-normal text-neutral-400">{relations.count ?? 0} 个关联</span></h2>{kind === "collections" && <><p className="text-sm text-neutral-400">顺序越小越靠前，相同顺序按作品 ID 排列。</p><CollectionMember series={id} /></>}
      {rows.map(row => <article key={`${row.media_item_id}:${row.role ?? ""}`} className="surface-panel space-y-3 rounded-2xl p-4"><Link href={`/manage/media/${row.media_item_id}`} className="block break-words font-medium text-white hover:text-red-300">{row.media_items?.title ?? "作品"} →</Link>{row.role && <p className="text-sm text-neutral-400">{row.role === "actor" ? "演员" : row.role === "director" ? "导演" : row.role}</p>}{kind === "collections" && <CollectionMember series={id} item={{ id: row.media_item_id, title: row.media_items?.title ?? "作品", position: row.position ?? null }} />}</article>)}
      {!rows.length && <p className="py-6 text-sm text-neutral-400">还没有关联作品。</p>}
      <nav aria-label="关联作品分页" className="flex justify-between">{page > 1 ? <Link href={`?page=${page - 1}`}>上一页</Link> : <span />}{page * 25 < (relations.count ?? 0) && <Link href={`?page=${page + 1}`}>下一页</Link>}</nav>
    </section>
  </section>;
}
