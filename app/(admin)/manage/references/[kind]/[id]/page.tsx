import BackToList from "../../../BackToList";
import { notFound, redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/server";
import { isReferenceType, referenceTypes, type ReferenceType } from "@/lib/admin/catalog";
import { groupCredits, relatedMediaColumns, relatedMediaFields, relatedMediaSortFields, type CreditRow, type RelatedMedia } from "@/lib/admin/credits";
import { isMediaId } from "@/lib/functions/media-id";
import ReferenceForm from "../../ReferenceForm";
import CollectionMember from "../../CollectionMember";
import RelatedWork from "../../RelatedWork";
import FilmographyRow from "../../FilmographyRow";
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

/** 电视节目与季不填自己的日期，首播日期取最早一集：季看所属单集，节目看全部季。返回 id → 日期，没有带日期单集的不出现。 */
async function readFirstAirDates(db: Db, media: RelatedMedia[]) {
  const ids = [...new Set(media.filter(item => item.type === "tv_show" || item.type === "tv_season").map(item => item.id))];
  const dates = new Map<string, string>();
  for (let start = 0; start < ids.length; start += 100) {
    const chunk = ids.slice(start, start + 100).join(",");
    for (let offset = 0; ; offset += LINK_CHUNK) {
      const { data, error } = await db.from("tv_seasons").select("id,series_id,episodes:tv_episodes!tv_episodes_season_id_fkey(media_items!tv_episodes_id_fkey(release_date))")
        .or(`id.in.(${chunk}),series_id.in.(${chunk})`).order("id").range(offset, offset + LINK_CHUNK - 1);
      if (error) throw new Error("无法完整读取资料，请重试。");
      for (const season of data as unknown as { id: string; series_id: string; episodes: { media_items: { release_date: string | null } | null }[] }[]) {
        const first = season.episodes.map(episode => episode.media_items?.release_date).filter((date): date is string => !!date).sort()[0];
        if (!first) continue;
        for (const key of [season.id, season.series_id]) if (!dates.has(key) || first < dates.get(key)!) dates.set(key, first);
      }
      if (data.length < LINK_CHUNK) break;
    }
  }
  return dates;
}

/** 完整读取资料和关联，查询失败不得把空结果当成真实数据。 */
export default async function ReferenceDetail({ params, searchParams }: { params: Promise<{ kind: string; id: string }>; searchParams: Promise<{ saved?: string; page?: string; n?: string }> }) {
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
  const memberRows = (members?.data ?? []) as unknown as { media_item_id: string; position?: number | null; media_items: RelatedMedia | null }[];
  const linkedMedia = [...(links ?? []), ...memberRows].flatMap(row => row.media_items ?? []);
  // 首播日期在分组排序前写回，节目与季才能和电影一样按日期排序。
  const airDates = await readFirstAirDates(db, linkedMedia);
  const withAirDate = (media: RelatedMedia) => { const date = airDates.get(media.id); if (date) media.release_date = date; return media; };
  linkedMedia.forEach(withAirDate);

  const groups = links ? groupCredits(links) : [];
  const works = groups.flatMap(group => group.works);
  // 只有一种职务时每行都写「演员」是噪音，兼任多种职务才逐行标出。
  const multiRole = new Set(works.flatMap(work => work.roles)).size > 1;
  const count = links ? links.length : members?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil((links ? works.length : count) / PAGE_SIZE));
  if (page > totalPages) redirect(`${basePath}?page=${totalPages}`);
  const pageIds = new Set(works.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(work => work.media.id));
  const details = new Map<string, RelatedMedia>();
  if (pageIds.size) {
    const { data, error } = await db.from("media_items").select(relatedMediaColumns).in("id", [...pageIds]);
    if (error) throw new Error("无法完整读取资料，请重试。");
    for (const media of data as unknown as RelatedMedia[]) details.set(media.id, withAirDate(media));
  }

  return <section><header className="mb-8"><BackToList category={kind} /><h1 className="admin-heading break-words">{item.name}</h1></header>{search.saved && <StatusModal key={search.n} message="保存成功，关联作品已同步更新。" />}
    {/* 资料表单只有两三个字段，横排放在顶部，关联作品占满整宽。 */}
    <div className="space-y-8">
    <ReferenceForm key={`${id}:${item.name}:${item.alternate_name}`} kind={kind} item={item} count={count} inline />
    <section className="min-w-0 space-y-4"><h2 className="admin-section-title text-xl font-semibold text-white">{collections ? "系列作品" : "关联作品"} <span className="font-mono text-sm font-normal text-neutral-400">{kind === "people" ? `${works.length} 部作品 · ` : ""}{count} 个关联</span></h2>{collections && <><p className="text-sm text-neutral-400">顺序越小越靠前，相同顺序按作品 ID 排列。移除只解除关联，不会删除作品。</p><CollectionMember series={id} /></>}
      {groups.map(group => {
        const visible = group.works.filter(work => pageIds.has(work.media.id));
        if (!visible.length) return null;
        return <section key={group.type} aria-labelledby={`related-${group.type}`} className="space-y-3"><h3 id={`related-${group.type}`} className="pt-2 text-base font-semibold text-white">{group.label} <span className="text-sm font-normal text-neutral-400">{group.works.length}</span></h3>
          <ol className="surface-panel divide-y divide-white/10 overflow-hidden rounded-2xl">{visible.map((work, index) => <FilmographyRow key={work.media.id} media={details.get(work.media.id) ?? work.media} roles={work.roles} characters={work.characters} showRoles={multiRole}
            showYear={index === 0 || visible[index - 1].media.release_date?.slice(0, 4) !== work.media.release_date?.slice(0, 4)} />)}</ol>
        </section>;
      })}
      {memberRows.map(row => row.media_items && <RelatedWork key={row.media_item_id} media={row.media_items}><CollectionMember series={id} item={{ id: row.media_item_id, title: row.media_items.title, position: row.position ?? null }} /></RelatedWork>)}
      {!count && <p className="py-6 text-sm text-neutral-400">还没有关联作品。</p>}
      <ManagePagination page={page} totalPages={totalPages} params={{}} basePath={basePath} label="关联作品分页" />
    </section>
    </div>
  </section>;
}
