type EnvironmentVariables = Record<string, string | undefined>;

export function resolveSentryEnvironment(
  env: EnvironmentVariables,
): "local" | "ci" | "preview" | "production" {
  // GitHub browser tests remain CI even if deployment variables are present.
  if (env.GITHUB_ACTIONS === "true") return "ci";

  // Vercel builds also set CI, so deployment identity takes precedence.
  if (env.VERCEL_ENV === "production") return "production";
  if (env.VERCEL_ENV === "preview") return "preview";

  if (env.CI === "true" || env.CI === "1") return "ci";

  // NODE_ENV describes build mode, not where the application is running.
  return "local";
}
