"use server";
import { requireOwner } from "@/lib/auth/server";
import { escapeLikePattern, isReferenceType, mediaChoiceDetail, mediaChoiceFields, nameOrAliasFilter, referenceTypes, type Choice, type MediaChoiceRow } from "@/lib/admin/catalog";
import { isMediaId } from "@/lib/functions/media-id";
import { affectedMediaIds, mergeAffected, revalidateAllMedia, revalidateMediaItems } from "@/lib/admin/revalidate-media";
import { redirect } from "next/navigation";
import type { ActionResult } from "./actions";

/** 搜索只返回展示所需字段；每次调用仍独立验证站长身份。 */
export async function searchChoices(kind: string, term: string): Promise<{ choices: Choice[]; error?: string }> {
  const { db } = await requireOwner();
  const media = ["movie", "tv_show", "tv_season", "tv_episode", "media"].includes(kind);
  if (!media && !isReferenceType(kind)) return { choices: [], error: "不支持的资料类别。" };
  const table = media ? "media_items" : referenceTypes[kind as keyof typeof referenceTypes].table;
  let query = db.from(table).select(media ? mediaChoiceFields : kind === "people" ? "id,name,alternate_name" : "id,name").order(media ? "title" : "name").order("id").limit(20);
  const search = term.trim().slice(0, 200);
  // 人物、系列同时匹配别名，其余资料与影视只按名称／标题匹配。
  query = !media && referenceTypes[kind as keyof typeof referenceTypes].alternate ? query.or(nameOrAliasFilter(search)) : query.ilike(media ? "title" : "name", `%${escapeLikePattern(search)}%`);
  if (media) query = kind === "media" ? query.in("type", ["movie", "tv_show", "tv_season", "tv_episode"]) : query.eq("type", kind);
  const { data, error } = await query;
  if (error) return { choices: [], error: "搜索失败，请重试。" };
  return { choices: (data as unknown as (MediaChoiceRow & { id: string; title?: string; name?: string; alternate_name?: string | null; cover_url?: string | null })[]).map(/* 统一名称和影视标题；人物以别名区分同名者。 */ row => ({ id: row.id, name: row.title ?? row.name ?? "", detail: mediaChoiceDetail(row) ?? row.alternate_name ?? undefined, cover_url: row.cover_url })) };
}

/** 新建与编辑共用白名单，更新必须实际命中记录才报告成功。 */
export async function saveReference(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireOwner();
  const kind = String(form.get("kind") ?? "");
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const alternate = String(form.get("alternate_name") ?? "").trim();
  if (!isReferenceType(kind) || (id && !isMediaId(id)) || !name || name.length > 200 || alternate.length > 300) return { error: "请填写有效名称（最多 200 字）和别名（最多 300 字）。" };
  const config = referenceTypes[kind];
  const payload = { name, ...(config.alternate ? { alternate_name: alternate || null } : {}) };
  const query = id ? db.from(config.table).update(payload).eq("id", id) : db.from(config.table).insert(payload);
  const { data, error } = await query.select("id").single();
  if (error) return { error: error.code === "23505" ? (kind === "people" ? "已有同名且别名相同的人物，请填写不同的别名以区分。" : "此名称已经存在，请选择现有资料或使用其他名称。") : "保存失败，资料可能已被删除或暂无写入权限。" };
  // 人物、类型等资料可能被任意数量的条目引用，改名或删除时整体失效。
  revalidateAllMedia();
  if (form.get("return_list") === "1") return { saved: true };
  redirect(`/manage/references/${kind}/${data.id}?saved=1&n=${Date.now()}`);
}

/** 删除与名称确认在同一个数据库语句中完成，级联仅移除关联。 */
export async function deleteReference(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireOwner();
  const kind = String(form.get("kind") ?? "");
  const id = String(form.get("id") ?? "");
  const name = String(form.get("confirm_name") ?? "").trim();
  if (!isReferenceType(kind) || !isMediaId(id) || !name) return { error: "请输入完整名称以确认删除。" };
  const { data, error } = await db.from(referenceTypes[kind].table).delete().eq("id", id).eq("name", name).select("id");
  if (error) return { error: error.code === "23503" ? "此资料仍被其他内容引用，请先移除这些关联。" : "删除失败，请重试。" };
  if (!data?.length) return { error: "名称不匹配或资料已被删除，请刷新确认。" };
  revalidateAllMedia();
  redirect(`/manage/references/${kind}?deleted=1&n=${Date.now()}`);
}

/** 一次修改一个系列成员的顺序或关联，避免多请求重排造成部分保存。 */
export async function saveCollectionMember(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireOwner();
  const series = String(form.get("series_id") ?? "");
  const media = String(form.get("media_item_id") ?? "");
  const removing = form.get("intent") === "remove";
  if (!isMediaId(series) || !isMediaId(media)) return { error: "请选择有效作品与系列。" };
  const position = Number(form.get("position"));
  if (!removing && (!Number.isInteger(position) || position < 0 || position > 100000)) return { error: "请填写 0–100000 的整数顺序。" };
  const before = await affectedMediaIds(db, [media]);
  const result = removing
    ? await db.from("media_item_series").delete().eq("series_id", series).eq("media_item_id", media).select("media_item_id")
    : await db.from("media_item_series").upsert({ series_id: series, media_item_id: media, position }, { onConflict: "media_item_id,series_id" }).select("media_item_id");
  if (result.error || !result.data?.length) return { error: "关联保存失败，请刷新后重试。" };
  revalidateMediaItems(mergeAffected(before, await affectedMediaIds(db, [media])));
  return { saved: true };
}
