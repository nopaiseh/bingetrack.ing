// Sentry DSN 是公开的客户端标识而非密钥；集中定义供三个运行时与 CSP 共用，可用环境变量覆盖。
const DEFAULT_SENTRY_DSN = "https://3372f2ef28f0008a74b965e76a9dd7b4@o4512027852668928.ingest.de.sentry.io/4512027952545872";

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || DEFAULT_SENTRY_DSN;

/** 返回 DSN 对应的上报来源，供 CSP connect-src 使用；DSN 无效时返回空字符串。 */
export function sentryIngestOrigin(dsn = SENTRY_DSN): string {
  try { return new URL(dsn).origin; } catch { return ""; }
}
