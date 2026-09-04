const PRODUCTION_TRACES_SAMPLE_RATE = 0.1;
const NON_PRODUCTION_TRACES_SAMPLE_RATE = 1;

export function getDefaultSentryTracesSampleRate(
  nodeEnv = process.env.NODE_ENV,
): number {
  return nodeEnv === "production"
    ? PRODUCTION_TRACES_SAMPLE_RATE
    : NON_PRODUCTION_TRACES_SAMPLE_RATE;
}

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
