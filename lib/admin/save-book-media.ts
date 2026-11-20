import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaInput, PersonRef } from "@/lib/admin/media-form";
import { findBookDuplicateId } from "@/lib/books/dedupe";
import { isBookTrackingStatus } from "@/lib/read-status";

const WRITE_ERROR = "保存失败，请检查字段或数据库配置后重试。";
const PERMISSION_ERROR = "没有写入权限，请检查站长账号配置。";
const PAGE_COUNT_ERROR = "页数须为 1–20000 的整数，或留空。";
const DUPLICATE_ERROR = "已存在同名同作者的图书。";

function writeError(code?: string, message?: string) {
  if (code === "23505") return DUPLICATE_ERROR;
  if (code === "23503" || code === "P0002") return "资料已不存在，请刷新后重试。";
  if (code === "42501") return PERMISSION_ERROR;
  if (code === "23514" || (message && /page_count|Invalid page_count/i.test(message))) return PAGE_COUNT_ERROR;
  return WRITE_ERROR;
}

function assertOk(error: { code?: string; message?: string } | null) {
  if (!error) return;
  throw new SaveBookMediaError(writeError(error.code, error.message), error.code);
}

export class SaveBookMediaError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "SaveBookMediaError";
    this.code = code;
  }
}

function creditPayload(people: PersonRef[]) {
  return people.map(({ id, name }) => ({ id, name }));
}

/** 组装 manage_save_media／admin_save_media 可接受的图书 jsonb 负载。 */
function bookRpcPayload(payload: MediaInput) {
  const status = isBookTrackingStatus(payload.status) ? payload.status : "want_to_watch";
  return {
    id: payload.id,
    type: "book",
    title: payload.title,
    alternate_title: payload.alternate_title,
    summary: payload.summary,
    cover_url: payload.cover_url,
    release_date: payload.release_date,
    runtime: null,
    status,
    rating: payload.rating,
    genres: payload.genres,
    languages: payload.languages,
    authors: creditPayload(payload.authors),
    page_count: payload.page_count,
    publisher: payload.publisher,
    collections: payload.collections ?? [],
  };
}

/** 服务端校验页数；与 books_page_count_range_check 对齐。 */
export function assertBookPageCount(pageCount: number | null | undefined) {
  if (pageCount == null) return;
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 20000) {
    throw new SaveBookMediaError(PAGE_COUNT_ERROR, "22023");
  }
}

/**
 * 保存图书：应用层先查重与校验页数，再经 manage_save_media（含系列）一次事务写入。
 * RPC 内仍会校验作者上限与标题＋作者去重。
 */
export async function saveBookMedia(db: SupabaseClient, payload: MediaInput): Promise<string> {
  if (payload.type !== "book") throw new SaveBookMediaError("只支持图书。");
  assertBookPageCount(payload.page_count);
  if (payload.publisher != null && payload.publisher.length > 200) {
    throw new SaveBookMediaError("出版社最多 200 字。", "22023");
  }
  if (!isBookTrackingStatus(payload.status)) {
    throw new SaveBookMediaError("阅读状态只能是想读、在读或读过。", "22023");
  }

  const authorNames = payload.authors.map((person) => person.name);
  const duplicateId = await findBookDuplicateId(db, {
    title: payload.title,
    authors: authorNames,
  }).catch(() => null);
  if (duplicateId && duplicateId !== payload.id) {
    throw new SaveBookMediaError(DUPLICATE_ERROR, "23505");
  }

  const { data, error } = await db.rpc("manage_save_media", { p_data: bookRpcPayload(payload) });
  assertOk(error);
  if (!data) throw new SaveBookMediaError(WRITE_ERROR);
  return String(data);
}
