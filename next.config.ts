import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { resolveSentryEnvironment } from "./lib/sentry-environment";

const isDevelopment = process.env.NODE_ENV === "development";

/** 本地 Supabase 认证需要浏览器访问其 HTTP 端口；仅开发模式允许配置中的回环地址。 */
function localAuthOrigin() {
  if (!isDevelopment || !process.env.NEXT_PUBLIC_SUPABASE_URL) return "";
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ? ` ${url.origin}` : "";
  } catch { return ""; }
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://image.tmdb.org https://*.tmdb.org",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co https://o4512027852668928.ingest.de.sentry.io${localAuthOrigin()}`,
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // 把构建时确定的 Sentry 环境标签注入浏览器、Node 和 Edge 代码。
  env: {
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: resolveSentryEnvironment(process.env),
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [25, 75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        port: "",
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "**.tmdb.org",
      },
    ],
  },
  /** 为所有路径配置安全响应头，并仅在非开发模式下发送 HSTS。 */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...(!isDevelopment
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {

  org: "nopaiseh",

  project: "bingetracking",

  silent: !process.env.CI,


  widenClientFileUpload: true,


  webpack: {
    automaticVercelMonitors: true,

    treeshake: {
      removeDebugLogging: true,
    },
  },
});
