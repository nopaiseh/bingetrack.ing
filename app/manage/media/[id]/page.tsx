import BackToList from "../../BackToList";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/server";
import { isMediaId } from "@/lib/functions/media-id";
import { readEditableMedia } from "@/lib/admin/read-media";
import { mediaTypes } from "@/lib/admin/media-form";
import { readParent, readImpact } from "@/lib/admin/media-context";
import MediaForm from "../MediaForm";
import StatusModal from "../../StatusModal";

/** 载入完整编辑资料，并提供上下级导航及新增季集入口。 */
export default async function EditMediaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { db } = await requireOwner();
  const { id } = await params;
  if (!isMediaId(id)) notFound();
  const item = await readEditableMedia(db, id);
  if (!item || !Object.hasOwn(mediaTypes, item.type)) notFound();
  const childType = item.type === "tv_series" ? "tv_season" : item.type === "tv_season" ? "tv_episode" : null;
  const [parent, impact] = await Promise.all([readParent(db, item.parent_id ?? ""), readImpact(db, id, item.type)]);
  const grandparent = parent?.detail === "tv_season" ? await db.from("tv_seasons").select("series_id").eq("id", parent.id).single() : null;
  if (grandparent?.error) throw new Error("无法读取电视剧资料。");
  const ancestor = grandparent?.data ? await readParent(db, grandparent.data.series_id) : undefined;
  const { saved } = await searchParams;
  const rootType = ancestor ? "tv_series" : parent?.detail ?? item.type;
  return <section>
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <nav aria-label="内容层级" className="mb-2 flex flex-wrap gap-2 text-sm text-neutral-400"><BackToList category={rootType} label={`← ${mediaTypes[rootType as keyof typeof mediaTypes]}`} className="" />{ancestor && <><span>/</span><Link href={`/manage/media/${ancestor.id}`} className="break-words">{ancestor.name}</Link></>}{parent && <><span>/</span><Link href={`/manage/media/${parent.id}`} className="break-words">{parent.name}</Link></>}</nav>
        <h1 className="admin-heading break-words">编辑：{item.title}</h1>
      </div>
      <div className="flex flex-wrap gap-3">
        {item.parent_id && <Link className="admin-button" href={`/manage/media/${item.parent_id}`}>上级条目</Link>}
        {childType && <><Link className="admin-button" href={`/manage?type=${childType}&parent=${id}`}>管理下属{mediaTypes[childType]}</Link><Link className="admin-button" href={`/manage/media/new?type=${childType}&parent=${id}`}>新增{mediaTypes[childType]}</Link></>}
        {(item.type === "movie" || item.type === "tv_series") && <Link className="admin-button" href={`/${item.type === "movie" ? "movies" : "series"}/${id}`}>查看公开页面</Link>}
      </div>
    </header>
    {saved === "1" && <StatusModal message="保存成功，公开页面缓存已更新。" />}
    <MediaForm key={JSON.stringify(item)} item={item} parent={parent} impact={impact} />
  </section>;
}
