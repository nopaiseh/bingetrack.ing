type RateLimitEntry = {
  count: number;
  resetAt: number;
};

declare global {
  var _apiRateLimits: Map<string, RateLimitEntry> | undefined;
}

const MAX_RATE_LIMIT_ENTRIES = 5_000;

export function checkRateLimit(
  request: Request,
  bucket: string,
  limit = 60,
  windowMs = 60_000,
) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || "unknown";
  const key = `${bucket}:${clientIp}`;
  const now = Date.now();
  const store = globalThis._apiRateLimits ??= new Map();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }

  current.count += 1;

  if (store.size > MAX_RATE_LIMIT_ENTRIES) {
    for (const [entryKey, entry] of store) {
      if (entry.resetAt <= now || store.size > MAX_RATE_LIMIT_ENTRIES) {
        store.delete(entryKey);
      }
      if (store.size <= MAX_RATE_LIMIT_ENTRIES) break;
    }
  }

  return { allowed: true, retryAfter: 0 };
}
