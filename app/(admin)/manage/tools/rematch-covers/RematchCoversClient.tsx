"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import {
  applyMusicCoversRematch,
  previewMusicCoversRematch,
  type RematchPreviewResult,
} from "@/app/(admin)/manage/rematch-cover-actions";
import type { RematchPreviewRow } from "@/lib/admin/rematch-music-covers";
import StatusModal from "../../StatusModal";

/** 有新图（非清空、非跳过）的行，供「全选有新图」使用。 */
function rowsWithNewCover(rows: readonly RematchPreviewRow[]) {
  return rows.filter((row) => !row.skipped && row.willChange && Boolean(row.newCover));
}

function allowedThumb(src: string | null | undefined) {
  if (!src) return null;
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return null;
    const host = url.hostname;
    if (
      host.endsWith(".mzstatic.com") ||
      host === "coverartarchive.org" ||
      host === "archive.org" ||
      host.endsWith(".archive.org")
    ) {
      return src;
    }
  } catch {
    return null;
  }
  return null;
}

function CoverThumb({ src, label }: { src: string | null; label: string }) {
  const cover = allowedThumb(src);
  if (!cover) {
    return (
      <span className="flex size-14 items-center justify-center rounded-md bg-white/5 text-xs text-fg-subtle">
        {label}
      </span>
    );
  }
  return <Image src={cover} alt="" width={56} height={56} unoptimized className="size-14 rounded-md object-cover" />;
}

function rowHint(row: RematchPreviewRow) {
  if (row.skipped) return " · 超时跳过，将留到下一批";
  if (!row.willChange) return " · 结果相同";
  if (!row.newCover) return " · 无匹配将清空";
  return "";
}

/** 重新匹配音乐封面：游标分页预览，默认不勾选，勾选后再提交。 */
export default function RematchCoversClient() {
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<RematchPreviewRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const [notice, setNotice] = useState<{ id: number; tone: "success" | "error"; message: string } | null>(null);

  function showError(message: string) {
    setNotice({ id: Date.now(), tone: "error", message });
  }

  function showSuccess(message: string) {
    setNotice({ id: Date.now(), tone: "success", message });
  }

  function applyPreviewResult(result: Extract<RematchPreviewResult, { ok: true }>) {
    setRows(result.rows);
    setHasMore(result.hasMore);
    setNextCursor(result.nextCursor);
    // 预览结果默认全部不勾选（含「无匹配将清空」）。
    setSelected(new Set());
    setSkipped(result.skipped);
    setLoaded(true);
  }

  function runPreview(afterId: string | null, mode: "first" | "next") {
    startTransition(async () => {
      const result: RematchPreviewResult = await previewMusicCoversRematch(afterId);
      if (!result.ok) {
        showError(result.error);
        return;
      }
      applyPreviewResult(result);
      if (result.rows.length === 0) {
        showSuccess(mode === "next" ? "没有更多 mzstatic 封面了。" : "当前没有主机为 mzstatic.com 的音乐封面。");
        return;
      }
      if (result.skipped > 0) {
        showSuccess(`本批有 ${result.skipped} 条因超时跳过，可点「下一批」继续。`);
      }
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectRowsWithNewCover() {
    setSelected(new Set(rowsWithNewCover(rows).map((row) => row.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function runApply() {
    const payload = rows
      .filter((row) => selected.has(row.id) && !row.skipped)
      .map((row) => ({
        id: row.id,
        cover_url: row.newCover,
        expected_cover_url: row.oldCover,
      }));
    if (payload.length === 0) {
      showError("请至少勾选一条要替换的封面。");
      return;
    }
    startTransition(async () => {
      const result = await applyMusicCoversRematch(payload);
      if (!result.ok) {
        showError(result.error);
        return;
      }
      showSuccess(
        `已更新 ${result.succeeded} 条` +
          (result.cleared ? `（其中清空 ${result.cleared} 条）` : "") +
          (result.conflicted ? `，${result.conflicted} 条因封面已变而跳过` : "") +
          (result.failed ? `，失败 ${result.failed} 条` : "") +
          "。",
      );
      const removed = new Set(result.succeededIds);
      setRows((prev) => prev.filter((row) => !removed.has(row.id)));
      setSelected(new Set());
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="admin-primary" disabled={pending} onClick={() => runPreview(null, "first")}>
          {pending && !loaded ? "正在预览…" : loaded ? "从头预览" : "预览本批"}
        </button>
        <button
          type="button"
          disabled={pending || !hasMore}
          onClick={() => runPreview(nextCursor, "next")}
          title={!hasMore ? "没有下一批" : undefined}
        >
          下一批
        </button>
        <button
          type="button"
          disabled={pending || rowsWithNewCover(rows).length === 0}
          onClick={selectRowsWithNewCover}
        >
          全选有新图的行
        </button>
        <button type="button" disabled={pending || selected.size === 0} onClick={clearSelection}>
          清空勾选
        </button>
        <button type="button" disabled={pending || selected.size === 0} onClick={runApply}>
          {pending && loaded ? "正在提交…" : `提交勾选（${selected.size}）`}
        </button>
      </div>
      {loaded ? (
        <p className="text-sm text-fg-secondary">
          本批 {rows.length} 条{skipped ? `，超时跳过 ${skipped} 条` : ""}
          {hasMore ? "；还有后续批次。" : "；已到末尾。"}
          默认不勾选；「全选有新图」不含将清空的行。
        </p>
      ) : (
        <p className="text-sm text-fg-secondary">先点预览：服务端用新规则重新解析，不会改库。</p>
      )}

      {!loaded ? null : rows.length === 0 ? (
        <p className="text-sm text-fg-secondary">本批没有可处理的条目。</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="admin-list-table w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-fg-subtle">
                <th className="w-10 px-3 py-2">选</th>
                <th className="px-3 py-2 font-medium">条目</th>
                <th className="px-3 py-2 font-medium">旧图</th>
                <th className="px-3 py-2 font-medium">新图</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)]/60">
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      disabled={row.skipped}
                      onChange={() => toggle(row.id)}
                      aria-label={`选择 ${row.title}`}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="font-medium text-fg">{row.title}</div>
                    <div className="text-xs text-fg-subtle">
                      {row.type === "album" ? "专辑" : "曲目"}
                      {row.artist ? ` · ${row.artist}` : ""}
                      {rowHint(row)}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <CoverThumb src={row.oldCover} label="旧" />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <CoverThumb
                      src={row.skipped ? null : row.newCover}
                      label={row.skipped ? "跳过" : row.newCover ? "新" : "无"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {notice ? (
        <StatusModal key={notice.id} tone={notice.tone} message={notice.message} onClose={() => setNotice(null)} />
      ) : null}
    </div>
  );
}
