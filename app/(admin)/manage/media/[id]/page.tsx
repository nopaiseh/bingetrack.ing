import BackToList from "../../BackToList";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/server";
import { isMediaId } from "@/lib/functions/media-id";
import { readEditableMedia } from "@/lib/admin/read-media";
import { mediaTypes } from "@/lib/admin/media-form";
import { readParent, readImpact, readSiblings, type Sibling } from "@/lib/admin/media-context";
import { readSeriesStructure } from "@/lib/admin/series-structure";
import MediaForm from "../MediaForm";
import StatusModal from "../../StatusModal";
import SeriesWorkspace from "../series/SeriesWorkspace";
import { formatCount } from "../series/shared";

const typeBadges = { tv_show: "border-sky-500/25 bg-sky-500/10 text-sky-300", tv_season: "border-amber-500/25 bg-amber-500/10 text-amber-300", tv_episode: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" } as const;

/** 载入完整编辑资料；电视节目、季与单集进入带剧集结构栏的工作台，季集只在结构栏中新增。 */
export default async function EditMediaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; add?: string }> }) {
  const { db } = await requireOwner();
  const { id } = await params;
  if (!isMediaId(id)) notFound();
  const item = await readEditableMedia(db, id);
  if (!item || !Object.hasOwn(mediaTypes, item.type)) notFound();
  const [parent, impact, siblings, structure] = await Promise.all([readParent(db, item.parent_id ?? ""), readImpact(db, id, item.type), readSiblings(db, item.type, item.parent_id, item.number), readSeriesStructure(db, { id, type: item.type, parent_id: item.parent_id })]);
  const grandparent = parent?.type === "tv_season" ? await db.from("tv_seasons").select("series_id").eq("id", parent.id).single() : null;
  if (grandparent?.error) throw new Error("无法读取电视节目资料。");
  const ancestor = grandparent?.data ? await readParent(db, grandparent.data.series_id) : undefined;
  const { saved, add } = await searchParams;
  const rootType = ancestor ? "tv_show" : parent?.type ?? item.type;
  const unit = item.type === "tv_season" ? "季" : "集";
  /** 渲染前后条目链接；没有相邻条目时保留占位，避免按钮位置跳动。 */
  const siblingLink = (sibling: Sibling | undefined, direction: "previous" | "next") => {
    const label = direction === "previous" ? `上一${unit}` : `下一${unit}`;
    const icon = direction === "previous" ? "i-material-symbols-chevron-left-rounded" : "i-material-symbols-chevron-right-rounded";
    const align = direction === "previous" ? "" : "flex-row-reverse text-right";
    if (!sibling) return <span className={`surface-muted flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-neutral-500 opacity-60 ${align}`} aria-disabled="true"><span className={`${icon} size-5 shrink-0`} aria-hidden="true" />没有{label}</span>;
    return <Link href={`/manage/media/${sibling.id}?type=${item.type}`} rel={direction === "previous" ? "prev" : "next"} className={`surface-panel group flex min-w-0 items-center gap-2 rounded-2xl px-4 py-3 transition-colors hover:bg-white/5 ${align}`}>
      <span className={`${icon} size-5 shrink-0 text-neutral-400 group-hover:text-[var(--accent-hover)]`} aria-hidden="true" />
      <span className="min-w-0"><span className="block text-xs text-neutral-400">{label} · {sibling.season != null && `第 ${sibling.season} 季 `}第 {sibling.number} {unit}</span><span className="block truncate text-sm font-medium text-white group-hover:text-[var(--accent-hover)]">{sibling.title}</span></span>
    </Link>;
  };
  const season = structure?.seasons.find(entry => entry.id === structure.expandedSeasonId);
  const facts = !structure ? null
    : item.type === "tv_show" ? `${formatCount(structure.seasons.length)} 季 · ${formatCount(structure.totalEpisodes)} 集`
    : item.type === "tv_season" ? `第 ${item.number} 季 · ${formatCount(season?.episodeCount ?? 0)} 集`
    : [season && `第 ${season.number} 季`, `第 ${formatCount(item.number ?? 0)} 集`, item.release_date].filter(Boolean).join(" · ");
  // 与列表页标题一致的玻璃卡片；公开页面按钮固定在右下，长标题只在左栏内换行。
  const header = <header className="surface-panel flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:p-8">
    <div className="min-w-0 flex-1">
      <nav aria-label="内容层级" className="mb-2 flex flex-wrap gap-2 text-sm text-neutral-400"><BackToList category={rootType} label={`← ${mediaTypes[rootType as keyof typeof mediaTypes]}`} className="" />{ancestor && <><span>/</span><Link href={`/manage/media/${ancestor.id}?type=tv_show`} className="break-words">{ancestor.name}</Link></>}{parent && <><span>/</span><Link href={`/manage/media/${parent.id}?type=${parent.type}`} className="break-words">{parent.name}</Link></>}</nav>
      <h1 className="admin-heading break-words">{item.title}</h1>
      {facts && item.type !== "movie" && <p className="mt-3 flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${typeBadges[item.type]}`}>{mediaTypes[item.type]}</span><span className="font-mono text-sm text-neutral-400">{facts}</span></p>}
    </div>
    {(item.type === "movie" || item.type === "tv_show") && <Link className="admin-button shrink-0 self-start sm:self-end" href={`/${item.type === "movie" ? "movies" : "shows"}/${id}`}><span className="i-material-symbols-arrow-outward-rounded size-4.5" aria-hidden="true" />查看公开页面</Link>}
  </header>;
  const body = <>
    {(siblings.previous || siblings.next) && <nav aria-label={`相邻${mediaTypes[item.type as keyof typeof mediaTypes]}`} className="grid grid-cols-2 gap-3">{siblingLink(siblings.previous, "previous")}{siblingLink(siblings.next, "next")}</nav>}
    {saved === "1" && <StatusModal message="保存成功，公开页面缓存已更新。" />}
    <MediaForm key={JSON.stringify(item)} item={item} parent={parent} impact={impact} />
  </>;
  if (!structure || item.type === "movie") return <section className="space-y-6">{header}{body}</section>;
  return <SeriesWorkspace structure={structure} current={{ type: item.type, id }} header={header} initialAdd={add === "season" || add === "episode" ? add : undefined}>{body}</SeriesWorkspace>;
}
