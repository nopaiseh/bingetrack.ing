import BackToList from "../../BackToList";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/server";
import { isMediaId } from "@/lib/functions/media-id";
import { readEditableMedia } from "@/lib/admin/read-media";
import { mediaTypes } from "@/lib/admin/media-form";
import { readParent, readImpact } from "@/lib/admin/media-context";
import MediaForm from "../MediaForm";

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
  return <section><BackToList category={item.type} />
    <nav aria-label="内容层级" className="mb-5 flex flex-wrap gap-2 text-sm text-neutral-400"><Link href={`/manage?type=${ancestor ? "tv_series" : parent?.detail ?? item.type}`}>{ancestor ? "电视剧" : parent ? mediaTypes[parent.detail as keyof typeof mediaTypes] : mediaTypes[item.type]}</Link>{ancestor && <><span>/</span><Link href={`/manage/media/${ancestor.id}`}>{ancestor.name}</Link></>}{parent && <><span>/</span><Link href={`/manage/media/${parent.id}`}>{parent.name}</Link></>}<span>/</span><span className="break-words text-neutral-200">{item.title}</span></nav>
    <h1 className="admin-heading mb-6 break-words">编辑：{item.title}</h1>
    <div className="mb-8 flex flex-wrap gap-3">
      {item.parent_id && <Link className="admin-button" href={`/manage/media/${item.parent_id}`}>上级条目</Link>}
      {childType && <><Link className="admin-button" href={`/manage?type=${childType}&parent=${id}`}>管理下属{mediaTypes[childType]}</Link><Link className="admin-button" href={`/manage/media/new?type=${childType}&parent=${id}`}>新增{mediaTypes[childType]}</Link></>}
      {(item.type === "movie" || item.type === "tv_series") && <Link className="admin-button" href={`/${item.type === "movie" ? "movies" : "series"}/${id}`}>查看公开页面</Link>}
    </div>
    {saved === "1" && <p role="status" className="mb-6 text-green-300">保存成功，公开页面缓存已更新。</p>}
    <MediaForm key={JSON.stringify(item)} item={item} parent={parent} impact={impact} />
  </section>;
}
