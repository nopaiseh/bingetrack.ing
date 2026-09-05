import { expect, test } from "vitest";
import { resolveSentryEnvironment } from "../lib/sentry-environment";

test("local production builds do not report as production deployments", () => {
  expect(resolveSentryEnvironment({ NODE_ENV: "production" })).toBe("local");
  expect(resolveSentryEnvironment({ NODE_ENV: "development" })).toBe("local");
  expect(resolveSentryEnvironment({ CI: "false" })).toBe("local");
});

test("GitHub browser tests remain CI with deployment variables present", () => {
  expect(resolveSentryEnvironment({
    NODE_ENV: "production", GITHUB_ACTIONS: "true", VERCEL_ENV: "production",
  })).toBe("ci");
  expect(resolveSentryEnvironment({ CI: "true" })).toBe("ci");
  expect(resolveSentryEnvironment({ CI: "1" })).toBe("ci");
});

test("Vercel deployments take precedence over the generic CI flag", () => {
  expect(resolveSentryEnvironment({ VERCEL_ENV: "production", CI: "1" })).toBe("production");
  expect(resolveSentryEnvironment({ VERCEL_ENV: "preview", CI: "1" })).toBe("preview");
  expect(resolveSentryEnvironment({ VERCEL_ENV: "development" })).toBe("local");
});
