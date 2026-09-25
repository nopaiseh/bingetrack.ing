
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
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  ),

  dataCollection: {
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
