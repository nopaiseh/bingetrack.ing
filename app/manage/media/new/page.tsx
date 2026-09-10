import { requireOwner } from "@/lib/auth/server";
import { mediaTypes, type ManagedMediaType } from "@/lib/admin/media-form";
import { isMediaId } from "@/lib/functions/media-id";
import MediaForm from "../MediaForm";

/** 从上级页面进入时预填类型和父条目，保存时仍在数据库验证关系。 */
export default async function NewMediaPage({ searchParams }: { searchParams: Promise<{ type?: string; parent?: string }> }) {
  await requireOwner();
  const params = await searchParams;
  const type = params.type && Object.hasOwn(mediaTypes, params.type) ? params.type as ManagedMediaType : "movie";
  return <section><h1 className="admin-heading mb-8">新增媒体</h1><MediaForm initialType={type} parent={isMediaId(params.parent) ? params.parent : ""} /></section>;
}
