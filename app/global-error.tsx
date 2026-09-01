"use client";

import { RotateCcw } from "lucide-react";

export default function GlobalError() {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-neutral-950 text-neutral-200">
        <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-24">
          <section className="w-full rounded-2xl border border-red-400/20 bg-white/5 p-8 text-center">
            <p className="font-mono text-sm font-bold tracking-widest text-red-400">暂时无法加载</p>
            <h1 className="mt-3 text-2xl font-bold text-white">应用程序遇到问题</h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/60">
              请稍后重试，或立即重新加载应用程序。
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-7 inline-flex items-center gap-2 rounded-xl border border-red-400/40 bg-red-500/15 px-5 py-3 text-sm font-bold text-red-300"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              重新加载
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
