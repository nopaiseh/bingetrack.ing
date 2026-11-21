"use server";

import { requireOwner } from "@/lib/auth/server";
import {
  applyMusicCoverRematch,
  listMzstaticMusicItems,
  parseRematchApplyPayload,
  previewMusicCoverRematch,
  REMATCH_BATCH_SIZE,
  REMATCH_PREVIEW_DEADLINE_MS,
  type RematchPreviewRow,
} from "@/lib/admin/rematch-music-covers";
import { isMediaId } from "@/lib/functions/media-id";
import { reportHandledError } from "@/lib/report-error";

export type RematchPreviewResult =
  | {
      ok: true;
      rows: RematchPreviewRow[];
      nextCursor: string | null;
      hasMore: boolean;
      skipped: number;
    }
  | { ok: false; error: string };

export type RematchApplyActionResult =
  | {
      ok: true;
      succeeded: number;
      failed: number;
      cleared: number;
      conflicted: number;
      conflictIds: string[];
      succeededIds: string[];
    }
  | { ok: false; error: string };

/** 预览：按 id 游标取一批 mzstatic 条目并用新规则解析；超时未处理的留给下一批。 */
export async function previewMusicCoversRematch(afterId?: string | null): Promise<RematchPreviewResult> {
  const { db } = await requireOwner();
  const cursor = afterId && isMediaId(afterId) ? afterId : null;
  try {
    const listed = await listMzstaticMusicItems(db, { limit: REMATCH_BATCH_SIZE, afterId: cursor });
    const preview = await previewMusicCoverRematch(listed.items, {
      deadlineAt: Date.now() + REMATCH_PREVIEW_DEADLINE_MS,
    });
    // 有跳过：下一批从最后已处理之后继续（跳过条会再次出现）；全跳过则沿用入参游标。
    const nextCursor = preview.skipped > 0 ? (preview.nextCursor ?? cursor) : (preview.nextCursor ?? listed.nextCursor);
    const hasMore = preview.skipped > 0 || listed.hasMore;
    return {
      ok: true,
      rows: preview.rows,
      nextCursor,
      hasMore,
      skipped: preview.skipped,
    };
  } catch (error) {
    reportHandledError("manage previewMusicCoversRematch failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "预览失败，请重试。" };
  }
}

/** 提交：仅更新勾选条目（带旧封面乐观锁）。未勾选的不动。 */
export async function applyMusicCoversRematch(payload: unknown): Promise<RematchApplyActionResult> {
  const { db } = await requireOwner();
  const updates = parseRematchApplyPayload(payload);
  if (updates.length === 0) return { ok: false, error: "请至少勾选一条要替换的封面。" };
  try {
    const result = await applyMusicCoverRematch(db, updates);
    return { ok: true, ...result };
  } catch (error) {
    reportHandledError("manage applyMusicCoversRematch failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "提交失败，请重试。" };
  }
}
