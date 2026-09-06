const PRODUCTION_TRACES_SAMPLE_RATE = 0.1;
const NON_PRODUCTION_TRACES_SAMPLE_RATE = 1;

/** 按 NODE_ENV 返回性能追踪默认采样率：生产构建为 0.1，其余为 1。 */
export function getDefaultSentryTracesSampleRate(
  nodeEnv = process.env.NODE_ENV,
): number {
  return nodeEnv === "production"
    ? PRODUCTION_TRACES_SAMPLE_RATE
    : NON_PRODUCTION_TRACES_SAMPLE_RATE;
}

// 仅接受 0 到 1 的有限数值；空值或无效配置使用默认性能追踪采样率。
export function parseSentryTracesSampleRate(
  value: string | undefined,
  fallback = getDefaultSentryTracesSampleRate(),
): number {
  if (value === undefined || value.trim() === "") return fallback;

  const sampleRate = Number(value);
  return Number.isFinite(sampleRate) && sampleRate >= 0 && sampleRate <= 1
    ? sampleRate
    : fallback;
}
