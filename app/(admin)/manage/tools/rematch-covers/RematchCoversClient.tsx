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

/** 重新匹配音乐封面：先预览再勾选提交。 */
export default function RematchCoversClient() {
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<RematchPreviewRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<{ id: number; tone: "success" | "error"; message: string } | null>(null);

  function showError(message: string) {
    setNotice({ id: Date.now(), tone: "error", message });
  }

  function showSuccess(message: string) {
    setNotice({ id: Date.now(), tone: "success", message });
  }

  function runPreview() {
    startTransition(async () => {
      const result: RematchPreviewResult = await previewMusicCoversRematch();
      if (!result.ok) {
        showError(result.error);
        return;
      }
      setRows(result.rows);
      setTruncated(result.truncated);
      setSelected(new Set(result.rows.filter((row) => row.willChange).map((row) => row.id)));
      setLoaded(true);
      if (result.rows.length === 0) {
        showSuccess("当前没有主机为 mzstatic.com 的音乐封面。");
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

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rows.map((row) => row.id)));
  }

  function runApply() {
    const payload = rows.filter((row) => selected.has(row.id)).map((row) => ({ id: row.id, cover_url: row.newCover }));
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
          (result.failed ? `，失败 ${result.failed} 条` : "") +
          "。",
      );
      const submitted = new Set(payload.map((row) => row.id));
      setRows((prev) => prev.filter((row) => !submitted.has(row.id)));
      setSelected(new Set());
    });
  }

  const allChecked = rows.length > 0 && selected.size === rows.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="admin-primary" disabled={pending} onClick={runPreview}>
          {pending && !loaded ? "正在预览…" : loaded ? "重新预览本批" : "预览本批"}
        </button>
        <button type="button" disabled={pending || selected.size === 0} onClick={runApply}>
          {pending && loaded ? "正在提交…" : `提交勾选（${selected.size}）`}
        </button>
        {truncated ? (
          <p className="text-sm text-fg-secondary">还有更多 mzstatic 封面；提交本批后再预览下一批。</p>
        ) : null}
      </div>

      {!loaded ? (
        <p className="text-sm text-fg-secondary">先点预览：服务端用新规则重新解析，不会改库。</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-fg-secondary">本批没有可处理的条目。</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="admin-list-table w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-fg-subtle">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(event) => toggleAll(event.target.checked)}
                    aria-label="全选"
                  />
                </th>
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
                      onChange={() => toggle(row.id)}
                      aria-label={`选择 ${row.title}`}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="font-medium text-fg">{row.title}</div>
                    <div className="text-xs text-fg-subtle">
                      {row.type === "album" ? "专辑" : "曲目"}
                      {row.artist ? ` · ${row.artist}` : ""}
                      {!row.willChange ? " · 结果相同" : row.newCover ? "" : " · 无匹配将清空"}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <CoverThumb src={row.oldCover} label="旧" />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <CoverThumb src={row.newCover} label={row.newCover ? "新" : "无"} />
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
