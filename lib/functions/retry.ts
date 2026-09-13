/**
 * 识别数据库或网络访问中的瞬时故障（如 504 Gateway Timeout、连接重置、网络超时等）。
 */
export function isTransientError(error: unknown, depth = 0): boolean {
  if (!error || depth > 4) return false;

  if (typeof error !== "object") {
    if (typeof error === "string") {
      return isTransientMessage(error);
    }
    return false;
  }

  const err = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
    details?: unknown;
    hint?: unknown;
    cause?: unknown;
    error?: unknown;
  };

  // HTTP 状态码识别
  const status = Number(err.status ?? err.statusCode);
  if ([408, 429, 502, 503, 504].includes(status)) {
    return true;
  }

  // 错误代码识别
  const code = String(err.code ?? "").toLowerCase();
  if (
    [
      "502",
      "503",
      "504",
      "408",
      "429",
      "etimedout",
      "econnreset",
      "econnrefused",
      "eai_again",
      "und_err_connect_timeout",
    ].includes(code)
  ) {
    return true;
  }

  // 文本信息识别
  if (typeof err.message === "string" && isTransientMessage(err.message)) return true;
  if (typeof err.details === "string" && isTransientMessage(err.details)) return true;
  if (typeof err.hint === "string" && isTransientMessage(err.hint)) return true;

  // 嵌套原因识别（如 MediaRepositoryError.cause）
  if (err.cause && isTransientError(err.cause, depth + 1)) return true;
  if (err.error && isTransientError(err.error, depth + 1)) return true;

  return false;
}

function isTransientMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  const patterns = [
    "gateway timeout",
    "bad gateway",
    "service unavailable",
    "fetch failed",
    "econnreset",
    "econnrefused",
    "etimedout",
    "timeout",
    "socket hang up",
    "network error",
    "upstream connect error",
    "connection closed",
    "statement timeout",
    "too many requests",
  ];
  return patterns.some((p) => lower.includes(p));
}

export type RetryOptions = {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
};

/**
 * 为异步函数增加针对瞬时错误的指数退避重试，防止冷启动或短暂网络抖动阻断执行。
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 2,
    initialDelayMs = 800,
    maxDelayMs = 3000,
    factor = 2,
    shouldRetry = isTransientError,
    onRetry,
  } = options;

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error;
      }
      attempt++;
      const delayMs = Math.min(initialDelayMs * Math.pow(factor, attempt - 1), maxDelayMs);
      if (onRetry) {
        onRetry(error, attempt, delayMs);
      } else {
        console.warn(`[withRetry] Transient error encountered (retry ${attempt}/${maxRetries} in ${delayMs}ms):`, error);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
