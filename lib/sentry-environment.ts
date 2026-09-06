type EnvironmentVariables = Record<string, string | undefined>;

/** 按 GitHub Actions、Vercel 部署环境、通用 CI 标志的优先级判断环境，默认归为本地。 */
export function resolveSentryEnvironment(
  env: EnvironmentVariables,
): "local" | "ci" | "preview" | "production" {
  // GitHub Actions 优先标记为 ci，避免测试继承部署变量后被归入生产环境。
  if (env.GITHUB_ACTIONS === "true") return "ci";

  // Vercel 也可能设置 CI，因此先按部署环境区分 production 与 preview。
  if (env.VERCEL_ENV === "production") return "production";
  if (env.VERCEL_ENV === "preview") return "preview";

  if (env.CI === "true" || env.CI === "1") return "ci";

  // 本地生产构建仍归为 local；NODE_ENV 只表示构建模式，不能代表部署位置。
  return "local";
}
