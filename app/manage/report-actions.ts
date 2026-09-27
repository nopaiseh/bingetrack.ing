"use server";
import { requireOwner } from "@/lib/auth/server";
import { isReportKind, reports } from "@/lib/admin/reports";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "./actions";

/** 批量删除报告中的全部闲置资料；确认数量须与当前报告一致，避免删除页面未显示的新增项目。 */
export async function deleteUnused(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireOwner();
  const report = String(form.get("report") ?? "");
  if (!isReportKind(report)) return { error: "不支持的报告。" };
  const config = reports[report];
  if (!("bulkDelete" in config)) return { error: "这份报告不支持批量删除。" };
  const expected = Number(form.get("confirm_count"));
  const { count, error: countError } = await db.from(config.view).select("id", { count: "exact", head: true });
  if (countError) return { error: "无法读取报告，请重试。" };
  if (!Number.isInteger(expected) || expected !== count) return { error: `请输入当前数量 ${count ?? 0} 以确认删除；如数量有变化，请刷新后再确认。` };
  const { data, error } = await db.rpc("manage_delete_unused", { p_kind: config.bulkDelete });
  if (error) return { error: error.code === "23503" ? "部分资料仍被其他内容引用，请刷新后重试。" : "删除失败，请重试。" };
  revalidateTag("media", { expire: 0 });
  revalidatePath("/", "layout");
  redirect(`/manage/reports/${report}?deleted=${Number(data) || 0}`);
}
