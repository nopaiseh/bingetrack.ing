import BackToList from "../../../BackToList";
import { notFound, redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/server";
import { isReferenceType, referenceTypes, type ReferenceType } from "@/lib/admin/catalog";
import { groupCredits, relatedMediaColumns, relatedMediaFields, relatedMediaSortFields, type CreditRow, type RelatedMedia } from "@/lib/admin/credits";
import { isMediaId } from "@/lib/functions/media-id";
import ReferenceForm from "../../ReferenceForm";
import CollectionMember from "../../CollectionMember";
import RelatedWork from "../../RelatedWork";
import StatusModal from "../../../StatusModal";
import ManagePagination from "../../../ManagePagination";

const PAGE_SIZE = 25;
const LINK_CHUNK = 1000;

type Db = Awaited<ReturnType<typeof requireOwner>>["db"];

/** 分组排序要看到全部关联：人物同一作品的多个职务不能被分页拆开，按日期排序也需要完整集合。只读轻量字段，卡片详情按页再取。 */
async function readAllLinks(db: Db, kind: Exclude<ReferenceType, "collections">, id: string) {
  const config = referenceTypes[kind];
  const rows: CreditRow[] = [];
  for (let offset = 0; ; offset += LINK_CHUNK) {
    let query = db.from(config.link).select(`media_item_id,${kind === "people" ? "role,character_name," : ""}${relatedMediaSortFields}`).eq(config.key, id).order("media_item_id");
    // 人物同一作品可有多个职务，分块读取需要唯一且稳定的排序键。
    if (kind === "people") query = query.order("role");
    const { data, error } = await query.range(offset, offset + LINK_CHUNK - 1);
    if (error) throw new Error("无法完整读取资料，请重试。");
    rows.push(...(data as unknown as CreditRow[]));
    if (data.length < LINK_CHUNK) return rows;
  }
}

/** 完整读取资料和关联，查询失败不得把空结果当成真实数据。 */
export default async function ReferenceDetail({ params, searchParams }: { params: Promise<{ kind: string; id: string }>; searchParams: Promise<{ saved?: string; page?: string }> }) {
  const { db } = await requireOwner();
  const { kind, id } = await params;
  if (!isReferenceType(kind) || (id !== "new" && !isMediaId(id))) notFound();
  const config = referenceTypes[kind];
  const search = await searchParams;
  if (id === "new") return <section><header className="mb-8"><BackToList category={kind} /><h1 className="admin-heading">新增{config.label}</h1></header><ReferenceForm kind={kind} /></section>;
  const page = Math.min(100000, Math.max(1, parseInt(search.page ?? "1", 10) || 1));
  const basePath = `/manage/references/${kind}/${id}`;
  const collections = kind === "collections";
  const [record, links, members] = await Promise.all([
    db.from(config.table).select(config.alternate ? "id,name,alternate_name" : "id,name").eq("id", id).maybeSingle(),
    collections ? null : readAllLinks(db, kind, id),
    // 系列按用户设定的顺序排列，可直接在数据库分页。
    collections ? db.from(config.link).select(`media_item_id,position,${relatedMediaFields}`, { count: "exact" }).eq(config.key, id).order("position").order("media_item_id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1) : null,
  ]);
  if (record.error || members?.error) throw new Error("无法完整读取资料，请重试。");
  if (!record.data) notFound();
  const item = record.data as unknown as { id: string; name: string; alternate_name?: string | null };

  const groups = links ? groupCredits(links) : [];
  const works = groups.flatMap(group => group.works);
  const count = links ? links.length : members?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil((links ? works.length : count) / PAGE_SIZE));
  if (page > totalPages) redirect(`${basePath}?page=${totalPages}`);
  const pageIds = new Set(works.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(work => work.media.id));
  const details = new Map<string, RelatedMedia>();
  if (pageIds.size) {
    const { data, error } = await db.from("media_items").select(relatedMediaColumns).in("id", [...pageIds]);
    if (error) throw new Error("无法完整读取资料，请重试。");
    for (const media of data as unknown as RelatedMedia[]) details.set(media.id, media);
  }
  const memberRows = (members?.data ?? []) as unknown as { media_item_id: string; position?: number | null; media_items: RelatedMedia | null }[];

  return <section><header className="mb-8"><BackToList category={kind} /><h1 className="admin-heading break-words">编辑：{item.name}</h1></header>{search.saved && <StatusModal message="保存成功，关联作品已同步更新。" />}
    <ReferenceForm key={`${id}:${item.name}:${item.alternate_name}`} kind={kind} item={item} count={count} />
    <section className="mt-10 space-y-4"><h2 className="admin-section-title text-xl font-semibold text-white">关联作品 <span className="text-sm font-normal text-neutral-400">{kind === "people" ? `${works.length} 部作品 · ` : ""}{count} 个关联</span></h2>{collections && <><p className="text-sm text-neutral-400">顺序越小越靠前，相同顺序按作品 ID 排列。</p><CollectionMember series={id} /></>}
      {groups.map(group => {
        const visible = group.works.filter(work => pageIds.has(work.media.id));
        if (!visible.length) return null;
        return <section key={group.type} aria-labelledby={`related-${group.type}`} className="space-y-3"><h3 id={`related-${group.type}`} className="pt-2 text-base font-semibold text-white">{group.label} <span className="text-sm font-normal text-neutral-400">{group.works.length}</span></h3>
          {visible.map(work => <RelatedWork key={work.media.id} media={details.get(work.media.id) ?? work.media} roles={work.roles} characters={work.characters} />)}
        </section>;
      })}
      {memberRows.map(row => row.media_items && <RelatedWork key={row.media_item_id} media={row.media_items}><CollectionMember series={id} item={{ id: row.media_item_id, title: row.media_items.title, position: row.position ?? null }} /></RelatedWork>)}
      {!count && <p className="py-6 text-sm text-neutral-400">还没有关联作品。</p>}
      <ManagePagination page={page} totalPages={totalPages} params={{}} basePath={basePath} label="关联作品分页" />
    </section>
  </section>;
}
