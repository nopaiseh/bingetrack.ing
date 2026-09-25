const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/**
 * 浏览器只需访问本项目的 Supabase 源：生产只接受 HTTPS；本地 Supabase 使用 HTTP 回环端口，仅开发模式允许。
 * 未配置或无效时回退到 Supabase 托管域名通配，保证构建不中断。
 */
export function supabaseConnectOrigin(supabaseUrl: string | undefined, isDevelopment: boolean): string {
  try {
    const url = new URL(supabaseUrl ?? "");
    if (url.protocol === "https:") return url.origin;
    if (isDevelopment && LOOPBACK_HOSTS.includes(url.hostname)) return url.origin;
  } catch { /* 使用下方回退值。 */ }
  return "https://*.supabase.co";
}

/**
 * 生成全站 CSP。script-src 保留 'unsafe-inline'：改用 nonce 需要每个页面按请求渲染，会失去 ISR 与静态缓存，
 * 且 Next.js 的内联 RSC 数据脚本也依赖它。
 */
export function buildContentSecurityPolicy(options: { isDevelopment: boolean; supabaseUrl?: string; sentryOrigin?: string }): string {
  const { isDevelopment, supabaseUrl, sentryOrigin } = options;
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://image.tmdb.org https://*.tmdb.org",
    "font-src 'self' data:",
    ["connect-src 'self'", supabaseConnectOrigin(supabaseUrl, isDevelopment), sentryOrigin].filter(Boolean).join(" "),
    "upgrade-insecure-requests",
  ].join("; ");
}
