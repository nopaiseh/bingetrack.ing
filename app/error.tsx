"use client";

import { RotateCcw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-6 py-24">
      <section className="glass-panel w-full rounded-2xl border border-red-400/20 p-8 text-center sm:p-12">
        <p className="font-mono text-sm font-bold tracking-widest text-red-400">暂时无法加载</p>
        <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">媒体数据出了点问题</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/60">
          数据服务可能暂时不可用。你可以稍后再试，或立即重新加载当前页面。
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-7 inline-flex items-center gap-2 rounded-xl border border-red-400/40 bg-red-500/15 px-5 py-3 text-sm font-bold text-red-300 transition-colors hover:bg-red-500/25 hover:text-red-200"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          重新加载
        </button>
      </section>
    </div>
  );
}
