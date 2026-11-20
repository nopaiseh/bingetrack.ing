"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireOwner } from "@/lib/auth/server";
import { parseMediaForm } from "@/lib/admin/media-form";
import { isMediaId } from "@/lib/functions/media-id";
import {
  affectedMediaIds,
  mergeAffected,
  revalidateAllMedia,
  revalidateMediaItems,
} from "@/lib/admin/revalidate-media";
import { deleteMusicTree, SaveMusicMediaError, saveMusicMedia } from "@/lib/admin/save-music-media";
import { SaveBookMediaError, saveBookMedia } from "@/lib/admin/save-book-media";
import { isExpectedDbError, isExpectedValidationCode, reportHandledError } from "@/lib/report-error";

export type ActionResult = { error?: string; saved?: boolean; id?: string };

/** 将数据库错误转换成可以采取行动的提示，不暴露 SQL 细节。 */
function writeError(code?: string) {
  if (code === "23505") return "同一电视节目、季或专辑中已存在这个编号，或已存在同名同作者图书。";
  if (code === "23503" || code === "P0002") return "资料或上级条目已不存在，请刷新后重试。";
  if (code === "42501") return "没有写入权限，请检查站长账号配置。";
  if (code === "23514") return "曲目时长须为 1–7200 秒的整数，或留空；图书页数须为 1–20000。";
  return "保存失败，请检查字段或数据库配置后重试。";
}

/** 删除后回到所属顶层列表：电影／专辑／图书各自列表，季集归电视节目，曲目归专辑。 */
function listTypeAfterDelete(type: string | null | undefined) {
  if (type === "album" || type === "music") return "album";
  if (type === "movie") return "movie";
  if (type === "book") return "book";
  return "tv_show";
}

/** 应用层校验抛出的 Save* 错误（无库错误码）、确认类 22023，或可预期唯一／外键冲突，不上报；其余视为数据库／未知错误。 */
function reportSaveDomainError(operation: string, mediaId: string | null | undefined, error: unknown) {
  if (error instanceof SaveMusicMediaError || error instanceof SaveBookMediaError) {
    if (!error.code || isExpectedValidationCode(error.code) || isExpectedDbError(error.code)) return;
    reportHandledError(`${operation} failed for media ${mediaId ?? "new"}:`, error);
    return;
  }
  reportHandledError(`${operation} failed for media ${mediaId ?? "new"}:`, error);
}

/** 保存媒体及关联资料；事务失败时不刷新公开缓存。快速新增选择连续录入时留在当前页，只刷新侧栏数据。 */
export async function saveMedia(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireOwner();
  let payload;
  try {
    payload = parseMediaForm(form);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "资料格式不正确。" };
  }
  // 保存前记下旧的上级与系列成员，条目移走后它们的详情页也要刷新。
  const before = payload.id ? await affectedMediaIds(db, [payload.id]) : [];

  let savedId: string;
  if (payload.type === "album" || payload.type === "music") {
    // 专辑／曲目：查重与封面在 saveMusicMedia，写入走 admin_save_album_with_tracks／admin_save_media。
    try {
      savedId = await saveMusicMedia(db, payload);
    } catch (error) {
      if (error instanceof SaveMusicMediaError) {
        reportSaveDomainError("manage saveMedia", payload.id, error);
        return { error: error.message };
      }
      reportSaveDomainError("manage saveMedia", payload.id, error);
      return { error: writeError() };
    }
  } else if (payload.type === "book") {
    try {
      savedId = await saveBookMedia(db, payload);
    } catch (error) {
      if (error instanceof SaveBookMediaError) {
        reportSaveDomainError("manage saveMedia", payload.id, error);
        return { error: error.message };
      }
      reportSaveDomainError("manage saveMedia", payload.id, error);
      return { error: writeError() };
    }
  } else {
    const { data, error } = await db.rpc("manage_save_media", { p_data: payload });
    if (error) {
      if (!isExpectedValidationCode(error.code) && !isExpectedDbError(error.code)) {
        reportHandledError(`manage saveMedia failed for media ${payload.id ?? "new"}:`, error);
      }
      return { error: writeError(error.code) };
    }
    savedId = String(data);
  }

  revalidateMediaItems(mergeAffected(before, await affectedMediaIds(db, [savedId])));
  if (form.get("after") === "continue") {
    refresh();
    return { saved: true, id: savedId };
  }
  redirect(`/manage/media/${savedId}?saved=1&n=${Date.now()}`);
}

/** 明确确认标题后，原子删除条目、下属季集／曲目和观看记录。 */
export async function deleteMedia(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireOwner();
  const id = String(form.get("id") ?? "");
  const title = String(form.get("confirm_title") ?? "");
  if (!isMediaId(id) || !title) return { error: "请输入要删除的完整标题。" };
  // 删除会级联移除关联，必须在删除前查出受影响的上级与系列成员，以及条目类型（删除后回到所属列表）。
  const affected = await affectedMediaIds(db, [id]);
  const { data: target } = await db.from("media_items").select("type").eq("id", id).maybeSingle();

  if (target?.type === "album" || target?.type === "music") {
    try {
      await deleteMusicTree(db, id, title);
    } catch (error) {
      if (error instanceof SaveMusicMediaError) {
        reportSaveDomainError("manage deleteMedia", id, error);
        return { error: error.code === "22023" ? error.message : writeError(error.code) };
      }
      reportSaveDomainError("manage deleteMedia", id, error);
      return { error: writeError() };
    }
  } else {
    const { error } = await db.rpc("admin_delete_media", { p_id: id, p_confirm_title: title });
    if (error) {
      if (!isExpectedValidationCode(error.code) && !isExpectedDbError(error.code)) {
        reportHandledError(`manage deleteMedia failed for media ${id}:`, error);
      }
      return { error: error.code === "22023" ? "标题不匹配，请输入当前条目的完整标题。" : writeError(error.code) };
    }
  }

  revalidateMediaItems(affected);
  redirect(`/manage?type=${listTypeAfterDelete(target?.type)}&deleted=1&n=${Date.now()}`);
}

/** 手动使公开数据缓存即时失效，同步数据库最新状态。仅站长可触发。 */
export async function manualRevalidateCache(): Promise<ActionResult> {
  // 身份校验放在 try 之外，会话过期时的重定向不能被当成普通错误吞掉。
  await requireOwner();
  try {
    revalidateAllMedia();
    return { saved: true };
  } catch (error) {
    reportHandledError("manage manualRevalidateCache failed:", error);
    return { error: error instanceof Error ? error.message : "刷新缓存失败。" };
  }
}
