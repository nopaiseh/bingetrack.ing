import * as Sentry from "@sentry/nextjs";

/** 根据 Next.js 当前运行时动态加载 Node 或 Edge 的 Sentry 初始化配置。 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
