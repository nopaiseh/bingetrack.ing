import { expect, test } from "vitest";
import { resolveSentryEnvironment } from "../lib/sentry-environment";

test("local production builds do not report as production deployments", /* 验证本地生产构建、开发构建和未启用 CI 的环境均归为 local。 */ () => {
  expect(resolveSentryEnvironment({ NODE_ENV: "production" })).toBe("local");
  expect(resolveSentryEnvironment({ NODE_ENV: "development" })).toBe("local");
  expect(resolveSentryEnvironment({ CI: "false" })).toBe("local");
});

test("GitHub browser tests remain CI with deployment variables present", /* 验证 GitHub Actions 优先于部署标志，通用 CI 标志也能识别为 ci。 */ () => {
  expect(resolveSentryEnvironment({
    NODE_ENV: "production", GITHUB_ACTIONS: "true", VERCEL_ENV: "production",
  })).toBe("ci");
  expect(resolveSentryEnvironment({ CI: "true" })).toBe("ci");
  expect(resolveSentryEnvironment({ CI: "1" })).toBe("ci");
});

test("Vercel deployments take precedence over the generic CI flag", /* 验证 Vercel 的生产和预览环境优先于通用 CI 标志。 */ () => {
  expect(resolveSentryEnvironment({ VERCEL_ENV: "production", CI: "1" })).toBe("production");
  expect(resolveSentryEnvironment({ VERCEL_ENV: "preview", CI: "1" })).toBe("preview");
  expect(resolveSentryEnvironment({ VERCEL_ENV: "development" })).toBe("local");
});
