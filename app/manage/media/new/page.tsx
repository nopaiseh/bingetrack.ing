import { requireOwner } from "@/lib/auth/server";
import { mediaTypes, type ManagedMediaType } from "@/lib/admin/media-form";
import { isMediaId } from "@/lib/functions/media-id";
import { readParent } from "@/lib/admin/media-context";
import MediaForm from "../MediaForm";

/** 从上级页面进入时预填类型和父条目，保存时仍在数据库验证关系。 */
export default async function NewMediaPage({ searchParams }: { searchParams: Promise<{ type?: string; parent?: string }> }) {
  const { db } = await requireOwner();
  const params = await searchParams;
  const type = params.type && Object.hasOwn(mediaTypes, params.type) ? params.type as ManagedMediaType : "movie";
  const parent = await readParent(db, isMediaId(params.parent) ? params.parent : "");
  let nextNumber: number | undefined;
  if (parent && (type === "tv_season" || type === "tv_episode")) {
    const season = type === "tv_season";
    const column = season ? "season_number" : "episode_number";
    const { data, error } = await db.from(season ? "tv_seasons" : "tv_episodes").select(column).eq(season ? "series_id" : "season_id", parent.id).order(column, { ascending: false }).limit(1);
    if (error) throw new Error("无法读取编号建议。");
    nextNumber = Math.min(100000, ((data as unknown as Record<string, number>[])?.[0]?.[column] ?? 0) + 1);
  }
  return <section><h1 className="admin-heading mb-8">新增媒体</h1><MediaForm initialType={type} parent={parent} nextNumber={nextNumber} /></section>;
}
