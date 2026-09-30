"use client";

import { useState, useTransition } from "react";
import { manualRevalidateCache } from "./actions";

interface RefreshCacheButtonProps {
  className?: string;
  /** 只显示图标，用于侧栏标题行与收起后的图标栏；结果经朗读区域播报。 */
  iconOnly?: boolean;
}

export default function RefreshCacheButton({ className = "", iconOnly = false }: RefreshCacheButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  function handleRefresh() {
    if (isPending) return;
    setStatus("idle");
    setErrorMessage("");

    startTransition(async () => {
      const result = await manualRevalidateCache();
      if (result.saved) {
        setStatus("success");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
        setErrorMessage(result.error ?? "刷新失败");
        setTimeout(() => setStatus("idle"), 4000);
      }
    });
  }

  if (iconOnly) {
    const label = isPending ? "正在刷新缓存" : status === "success" ? "缓存已刷新" : status === "error" ? (errorMessage || "刷新失败") : "刷新公开缓存";
    return (
      <>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isPending}
          title={`${label}（在 Supabase 直接修改数据后使用）`}
          aria-label={label}
          className={`!min-h-0 !size-10 !p-0 !rounded-xl ${status === "success" ? "!border-emerald-500/30 text-emerald-400" : status === "error" ? "!border-rose-500/30 text-rose-400" : "text-fg-secondary"} ${className}`}
        >
          <span className={`size-4.5 inline-block shrink-0 ${isPending ? "i-material-symbols-sync-rounded animate-spin" : status === "success" ? "i-material-symbols-check-circle-rounded" : "i-material-symbols-cached-rounded"}`} aria-hidden="true" />
        </button>
        <span role="status" className="sr-only">{status === "idle" ? "" : label}</span>
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isPending}
      title="清除并刷新 CDN 缓存（在 Supabase 直接修改数据后使用）"
      aria-label="刷新缓存"
      className={`inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50 ${
        status === "success"
          ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
          : status === "error"
          ? "border-rose-500/30 text-rose-400 bg-rose-500/10"
          : "text-fg-secondary"
      } ${className}`}
    >
      <span
        className={`size-3.5 inline-block shrink-0 ${
          isPending
            ? "i-material-symbols-sync-rounded animate-spin"
            : status === "success"
            ? "i-material-symbols-check-circle-rounded text-emerald-400"
            : "i-material-symbols-cached-rounded"
        }`}
        aria-hidden="true"
      />
      <span>{isPending ? "刷新中..." : status === "success" ? "已刷新" : status === "error" ? errorMessage : "刷新缓存"}</span>
    </button>
  );
}

