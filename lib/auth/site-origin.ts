type OriginRequest = {
  headers: { get(name: string): string | null };
  nextUrl: { origin: string };
};

/**
 * 活动上报只接受与本次请求 origin 完全相同的 Origin 头。
 * 不回退到 Host、反代协议或 NEXT_PUBLIC_SITE_URL，避免把确认链接那套放宽规则用在会延长会话的接口上。
 */
export function isStrictSiteOrigin(request: OriginRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.origin === "null" || origin !== parsed.origin) return false;
  return parsed.origin === request.nextUrl.origin;
}
