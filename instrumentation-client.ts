
import * as Sentry from "@sentry/nextjs";
import { parseSentryTracesSampleRate } from "./lib/sentry-sampling";

Sentry.init({
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
