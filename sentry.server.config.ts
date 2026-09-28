
import * as Sentry from "@sentry/nextjs";
import { parseSentryTracesSampleRate } from "./lib/sentry-sampling";
import { SENTRY_DSN } from "./lib/sentry-dsn";

Sentry.init({
  // 仅生产部署发送事件；本地、CI 和预览环境均关闭上报。
  enabled: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === "production",
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  dsn: SENTRY_DSN,

  // 这里只控制性能追踪采样，错误事件不受该采样率影响。
  tracesSampleRate: parseSentryTracesSampleRate(
    process.env.SENTRY_TRACES_SAMPLE_RATE,
  ),

  // 不上报 Cookie 与请求／响应正文：Supabase 会话令牌存放在 Cookie 中，正文可能包含观看记录等个人数据。
  dataCollection: {
    cookies: false,
    httpBodies: [],
  },
});
