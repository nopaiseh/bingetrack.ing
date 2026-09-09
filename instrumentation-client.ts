
import * as Sentry from "@sentry/nextjs";
import { parseSentryTracesSampleRate } from "./lib/sentry-sampling";

Sentry.init({
  // 仅生产部署发送事件；本地、CI 和预览环境均关闭上报。
  enabled: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === "production",
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  dsn: "https://3372f2ef28f0008a74b965e76a9dd7b4@o4512027852668928.ingest.de.sentry.io/4512027952545872",

  // 这里只控制性能追踪采样，错误事件不受该采样率影响。
  tracesSampleRate: parseSentryTracesSampleRate(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  ),

  dataCollection: {
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
