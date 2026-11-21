import "server-only";
import type { ChildListItem, MediaListItem } from "@/lib/admin/list-params";
import type { QueryError } from "./types";

export const LIST_READ_ERROR = "无法读取管理列表，请重试。";
/** 季与单集列表沿用管理页原文，避免去掉回退后用户看到的失败提示发生变化。 */
export const CHILD_LIST_READ_ERROR = "无法读取管理列表，请稍后重试。";
export const DELETE_ERROR = "删除失败，请重试。";
export const STATUS_ERROR = "状态更新失败，请重试。";
export const PERMISSION_ERROR = "没有写入权限，请检查站长账号配置。";
/** 与 supabase/config.toml 的 max_rows 一致。嵌入资源不保证超过这个数，所以单集按页读取。 */
export const EPISODE_PAGE = 1000;
export const MAX_EPISODE_PAGES = 100;

export function assertWrite(error: QueryError, fallback: string) {
  if (!error) return;
  if (error.code === "42501") throw new Error(PERMISSION_ERROR);
  throw new Error(fallback);
}

export function readPage<T>(result: { data: unknown; error: QueryError; count: number | null }, message: string) {
  if (result.error || typeof result.count !== "number") throw new Error(message);
  return { rows: (result.data ?? []) as T[], total: result.count };
}

export function readRows<T>(result: { data: unknown; error: QueryError }, message: string) {
  if (result.error) throw new Error(message);
  return (result.data ?? []) as T[];
}

export function toNumber(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mediaListStatus(value: string | null | undefined): MediaListItem["status"] {
  if (value === "watched" || value === "watching" || value === "want_to_watch" || value === "in_progress") {
    return value;
  }
  return "want_to_watch";
}

export function childWatchStatus(value: string | null | undefined): ChildListItem["status"] {
  if (value === "watched" || value === "watching" || value === "want_to_watch") return value;
  return "want_to_watch";
}

export function deletedIds(rows: { id: string }[]) {
  return new Set(rows.map((row) => row.id.toLowerCase()));
}

/** 只保留这次请求里的 ID，并按小写去重，避免返回行重复时把成功数加过请求数。 */
export function rowsIn<Row extends { id: string }>(rows: Row[], allowed: string[]) {
  const allow = new Set(allowed);
  const seen = new Set<string>();
  const unique: Row[] = [];
  for (const row of rows) {
    const id = row.id.toLowerCase();
    if (!allow.has(id) || seen.has(id)) continue;
    seen.add(id);
    unique.push({ ...row, id });
  }
  return unique;
}
