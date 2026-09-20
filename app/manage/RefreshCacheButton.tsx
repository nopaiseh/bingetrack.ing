"use client";

import { useState, useTransition } from "react";
import { manualRevalidateCache } from "./actions";

interface RefreshCacheButtonProps {
  className?: string;
  compact?: boolean;
}

export default function RefreshCacheButton({ className = "", compact = false }: RefreshCacheButtonProps) {
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

  if (compact) {
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
            : "text-white/70"
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

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isPending}
        title="清除并刷新 CDN 缓存（在 Supabase 直接修改数据后使用）"
        className={`flex w-full items-center gap-3 rounded-xl p-3 text-sm transition-colors hover:text-white disabled:opacity-50 ${
          status === "success"
            ? "text-emerald-400 bg-emerald-500/10"
            : status === "error"
            ? "text-rose-400 bg-rose-500/10"
            : "text-white/60 hover:bg-white/5"
        }`}
      >
        <span
          className={`size-4.5 inline-block shrink-0 ${
            isPending
              ? "i-material-symbols-sync-rounded animate-spin"
              : status === "success"
              ? "i-material-symbols-check-circle-rounded text-emerald-400"
              : "i-material-symbols-cached-rounded"
          }`}
          aria-hidden="true"
        />
        <span className="truncate">
          {isPending ? "正在刷新缓存..." : status === "success" ? "缓存已刷新 ✓" : status === "error" ? (errorMessage || "刷新失败") : "刷新缓存"}
        </span>
      </button>
    </div>
  );
}

