import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/server";
import { isMediaId } from "@/lib/functions/media-id";
import { readEditableMedia } from "@/lib/admin/read-media";
import { mediaTypes } from "@/lib/admin/media-form";
import MediaForm from "../MediaForm";

/** 载入完整编辑资料，并提供上下级导航及新增季集入口。 */
export default async function EditMediaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { db } = await requireOwner();
  const { id } = await params;
  if (!isMediaId(id)) notFound();
  const item = await readEditableMedia(db, id);
  if (!item || !Object.hasOwn(mediaTypes, item.type)) notFound();
  const childType = item.type === "tv_series" ? "tv_season" : item.type === "tv_season" ? "tv_episode" : null;
  const { saved } = await searchParams;
  return <section>
    <h1 className="mb-3 break-words text-3xl font-semibold text-white">编辑：{item.title}</h1>
    <div className="mb-8 flex flex-wrap gap-3">
      {item.parent_id && <Link className="admin-button" href={`/admin/media/${item.parent_id}`}>上级条目</Link>}
      {childType && <><Link className="admin-button" href={`/admin?type=${childType}&parent=${id}`}>管理下属{mediaTypes[childType]}</Link><Link className="admin-button" href={`/admin/media/new?type=${childType}&parent=${id}`}>新增{mediaTypes[childType]}</Link></>}
      {(item.type === "movie" || item.type === "tv_series") && <Link className="admin-button" href={`/${item.type === "movie" ? "movies" : "series"}/${id}`}>查看公开页面</Link>}
    </div>
    {saved === "1" && <p role="status" className="mb-6 text-green-300">保存成功，公开页面缓存已更新。</p>}
    <MediaForm key={id} item={item} />
  </section>;
}
