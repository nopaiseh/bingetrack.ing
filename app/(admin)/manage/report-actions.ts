"use server";
import { requireOwner } from "@/lib/auth/server";
import { isNameIssueItemId, normalizeNameIssueItemId } from "@/lib/admin/name-issue-item-id";
import { isReportKind, reports } from "@/lib/admin/reports";
import { referenceMediaIds, revalidateMediaItems, revalidatePersonItems } from "@/lib/admin/revalidate-media";
import { isMediaId } from "@/lib/functions/media-id";
import { isExpectedDbError, reportHandledError } from "@/lib/report-error";
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
  if (countError) {
    if (!isExpectedDbError(countError.code)) {
      reportHandledError(`manage deleteUnused count failed for report ${report}:`, countError);
    }
    return { error: "无法读取报告，请重试。" };
  }
  // 确认数量不符是用户可预期的校验，不上报。
  if (!Number.isInteger(expected) || expected !== count)
    return { error: `请输入当前数量 ${count ?? 0} 以确认删除；如数量有变化，请刷新后再确认。` };
  const { data, error } = await db.rpc("manage_delete_unused", { p_kind: config.bulkDelete });
  if (error) {
    if (!isExpectedDbError(error.code)) {
      reportHandledError(`manage deleteUnused failed for report ${report}:`, error);
    }
    return { error: error.code === "23503" ? "部分资料仍被其他内容引用，请刷新后重试。" : "删除失败，请重试。" };
  }
  // 闲置资料没有被任何作品引用，详情页不受影响；只刷新聚合数据，让筛选选项去掉已删除的项目。
  revalidateMediaItems([]);
  redirect(`/manage/reports/${report}?deleted=${Number(data) || 0}&n=${Date.now()}`);
}

// 一组疑似重复人物远少于此数；上限防止构造的请求让「不是同一人」写入的配对数按平方增长。
const MAX_PEOPLE_PER_GROUP = 20;

/** 读取表单里的人物 ID，统一小写（与数据库 uuid 排序一致）、去重，拒绝格式不正确或数量超出上限的值。 */
function personIds(form: FormData, key: string) {
  const values = [...new Set(form.getAll(key).map((value) => String(value).toLowerCase()))];
  return values.length <= MAX_PEOPLE_PER_GROUP && values.every(isMediaId) ? values : null;
}

/** 合并疑似重复人物：其余人物的演职关联并入保留的人物后删除；数据库一次完成，失败不改动任何资料。 */
export async function mergePeople(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireOwner();
  const keep = String(form.get("keep") ?? "").toLowerCase();
  const remove = personIds(form, "remove")?.filter((id) => id !== keep);
  if (!isMediaId(keep) || !remove?.length) return { error: "请选择要保留的人物。" };
  // 合并会删除其余人物及其演职关联，须在合并前查出这些人物参与的作品。
  const affected = await referenceMediaIds(db, "people", [keep, ...remove]);
  const { error } = await db.rpc("manage_merge_people", { p_keep: keep, p_remove: remove });
  if (error) {
    if (!isExpectedDbError(error.code)) {
      reportHandledError(`manage mergePeople failed for keep ${keep}:`, error);
    }
    if (error.code === "23503") return { error: "其中有人物仍是专辑艺术家，请先在专辑中更换艺术家。" };
    if (error.code === "23505") return { error: "保留的人物沿用别名后会与另一位同名同别名的人物重复，请先修改别名。" };
    if (error.code === "P0002") return { error: "人物已不存在，请刷新后重试。" };
    return { error: "合并失败，请重试。" };
  }
  revalidateMediaItems(affected);
  // 保留与被删人物的详情页都要失效。
  revalidatePersonItems([keep, ...remove]);
  redirect(`/manage/reports/similar-people?merged=${remove.length}&n=${Date.now()}`);
}

/** 标记一组人物不是同一人：记录组内每一对，之后不再出现在疑似重复人物报告中。 */
export async function dismissSimilarPeople(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireOwner();
  const ids = personIds(form, "person");
  if (!ids || ids.length < 2) return { error: "至少需要两位人物。" };
  const pairs = ids.flatMap((a, index) =>
    ids.slice(index + 1).map((b) => (a < b ? { person_a: a, person_b: b } : { person_a: b, person_b: a })),
  );
  const { error } = await db
    .from("people_distinct_pairs")
    .upsert(pairs, { onConflict: "person_a,person_b", ignoreDuplicates: true });
  if (error) {
    if (!isExpectedDbError(error.code)) {
      reportHandledError(`manage dismissSimilarPeople failed for ${ids.length} people:`, error);
    }
    return { error: error.code === "23503" ? "人物已不存在，请刷新后重试。" : "标记失败，请重试。" };
  }
  redirect(`/manage/reports/similar-people?dismissed=1&n=${Date.now()}`);
}

/** 确认疑似名字错误无误：记下确认时的名字；名字未改前不再出现在报告中。 */
export async function confirmSuspiciousName(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireOwner();
  const itemId = normalizeNameIssueItemId(String(form.get("item_id") ?? ""));
  const confirmedName = String(form.get("confirmed_name") ?? "");
  if (!isNameIssueItemId(itemId) || !confirmedName || confirmedName.length > 200) {
    return { error: "无法确认该条目，请刷新后重试。" };
  }
  // 表权限与 people_distinct_pairs 一致（无 update）；先删后插，等价于按 item_id upsert。
  const { error: clearError } = await db.from("name_issue_confirmations").delete().eq("item_id", itemId);
  if (clearError) {
    if (!isExpectedDbError(clearError.code)) {
      reportHandledError(`manage confirmSuspiciousName clear failed for ${itemId}:`, clearError);
    }
    return { error: "确认失败，请重试。" };
  }
  const { error } = await db
    .from("name_issue_confirmations")
    .upsert({ item_id: itemId, confirmed_name: confirmedName }, { onConflict: "item_id", ignoreDuplicates: true });
  if (error) {
    if (!isExpectedDbError(error.code)) {
      reportHandledError(`manage confirmSuspiciousName failed for ${itemId}:`, error);
    }
    return { error: "确认失败，请重试。" };
  }
  redirect(`/manage/reports/suspicious-names?confirmed=1&n=${Date.now()}`);
}
