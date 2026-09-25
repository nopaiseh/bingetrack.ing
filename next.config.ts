import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { resolveSentryEnvironment } from "./lib/sentry-environment";
import { sentryIngestOrigin } from "./lib/sentry-dsn";
import { buildContentSecurityPolicy } from "./lib/csp";

const isDevelopment = process.env.NODE_ENV === "development";

const contentSecurityPolicy = buildContentSecurityPolicy({
  isDevelopment,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  sentryOrigin: sentryIngestOrigin(),
});

const nextConfig: NextConfig = {
  // 把构建时确定的 Sentry 环境标签注入浏览器、Node 和 Edge 代码。
  env: {
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: resolveSentryEnvironment(process.env),
  },
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 512],
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
