"use server";

import { requireOwner } from "@/lib/auth/server";
import {
  applyMusicCoverRematch,
  listMzstaticMusicItems,
  parseRematchApplyPayload,
  previewMusicCoverRematch,
  REMATCH_BATCH_SIZE,
  type RematchPreviewRow,
} from "@/lib/admin/rematch-music-covers";
import { reportHandledError } from "@/lib/report-error";

export type RematchPreviewResult =
  | { ok: true; rows: RematchPreviewRow[]; truncated: boolean }
  | { ok: false; error: string };

export type RematchApplyActionResult =
  | { ok: true; succeeded: number; failed: number; cleared: number }
  | { ok: false; error: string };

/** 预览：拉取最多一批 mzstatic 音乐条目并用新规则重新解析封面。 */
export async function previewMusicCoversRematch(): Promise<RematchPreviewResult> {
  const { db } = await requireOwner();
  try {
    const items = await listMzstaticMusicItems(db, { limit: REMATCH_BATCH_SIZE, offset: 0 });
    // 再多取一条判断是否还有后续批次。
    const extra = await listMzstaticMusicItems(db, { limit: 1, offset: REMATCH_BATCH_SIZE });
    const rows = await previewMusicCoverRematch(items);
    return { ok: true, rows, truncated: extra.length > 0 };
  } catch (error) {
    reportHandledError("manage previewMusicCoversRematch failed:", error);
    return { ok: false, error: error instanceof Error ? error.message : "预览失败，请重试。" };
  }
}

/** 提交：仅更新勾选条目。未勾选的不动。 */
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
