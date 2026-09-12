"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** 上报根级渲染错误，并提供独立的 HTML 错误页面与整页刷新入口。 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(/* 在错误对象变化时将异常发送给 Sentry。 */ () => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[var(--canvas)] text-white/90">
        <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-24">
          <section className="surface-muted w-full rounded-2xl border border-red-400/20 p-8 text-center">
            <p className="font-mono text-sm font-bold tracking-widest text-red-400">暂时无法加载</p>
            <h1 className="mt-3 text-2xl font-bold text-white">应用程序遇到问题</h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/60">
              请稍后重试，或立即重新加载应用程序。
            </p>
            <button
              type="button"
              onClick={/* 重新加载整个页面以重试根级渲染。 */ () => window.location.reload()}
              className="surface-active mt-7 inline-flex items-center gap-2 rounded-xl border border-red-400/40 px-5 py-3 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/25"
            >
              <span className="i-material-symbols-refresh-rounded size-4 inline-block" aria-hidden="true" />
              重新加载
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
