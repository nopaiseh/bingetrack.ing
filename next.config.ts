import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { resolveSentryEnvironment } from "./lib/sentry-environment";
import { sentryIngestOrigin } from "./lib/sentry-dsn";
import { buildContentSecurityPolicy } from "./lib/csp";
import { TMDB_IMAGE_WIDTHS } from "./lib/tmdb-image";

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
  // 图片由 TMDB CDN 直接提供，不消耗 Vercel 的图片转换额度；srcset 只列出 TMDB 实际存在的宽度档位。
  images: {
    loader: "custom",
    loaderFile: "./lib/tmdb-image-loader.ts",
    imageSizes: TMDB_IMAGE_WIDTHS.slice(0, -1),
    deviceSizes: TMDB_IMAGE_WIDTHS.slice(-1),
  },
  // 图片不再经过 Next 的优化器，sharp 及其原生库不需要打进每个函数包。
  outputFileTracingExcludes: {
    "/*": ["node_modules/sharp/**/*", "node_modules/@img/**/*"],
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
