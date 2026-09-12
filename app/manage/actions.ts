"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireOwner } from "@/lib/auth/server";
import { parseMediaForm } from "@/lib/admin/media-form";
import { isMediaId } from "@/lib/functions/media-id";

export type ActionResult = { error?: string; saved?: boolean };

/** 将数据库错误转换成可以采取行动的提示，不暴露 SQL 细节。 */
function writeError(code?: string) {
  if (code === "23505") return "同一剧集或季中已存在这个编号，请更换编号。";
  if (code === "23503" || code === "P0002") return "资料或上级条目已不存在，请刷新后重试。";
  if (code === "42501") return "没有写入权限，请检查站长账号配置。";
  return "保存失败，请检查字段或数据库配置后重试。";
}

/** 保存媒体及关联资料；事务失败时不刷新公开缓存。 */
export async function saveMedia(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireOwner();
  let payload;
  try { payload = parseMediaForm(form); } catch (error) {
    return { error: error instanceof Error ? error.message : "资料格式不正确。" };
  }
  const { data, error } = await db.rpc("manage_save_media", { p_data: payload });
  if (error) return { error: writeError(error.code) };
  revalidateTag("media", { expire: 0 });
  revalidatePath("/", "layout");
  redirect(`/manage/media/${data}?saved=1`);
}

/** 明确确认标题后，原子删除条目、下属季集和观看记录。 */
export async function deleteMedia(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireOwner();
  const id = String(form.get("id") ?? "");
  const title = String(form.get("confirm_title") ?? "");
  if (!isMediaId(id) || !title) return { error: "请输入要删除的完整标题。" };
  const { error } = await db.rpc("admin_delete_media", { p_id: id, p_confirm_title: title });
  if (error) return { error: error.code === "22023" ? "标题不匹配，请输入当前条目的完整标题。" : writeError(error.code) };
  revalidateTag("media", { expire: 0 });
  revalidatePath("/", "layout");
  redirect("/manage?deleted=1");
}
