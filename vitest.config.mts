import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
      "server-only": `${import.meta.dirname}/node_modules/next/dist/compiled/server-only/empty.js`,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: [
        "lib/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "app/api/**/*.ts",
        "app/**/route.ts",
        "app/**/*actions.ts",
        "**/proxy.ts",
      ],
      exclude: [
        "lib/types/**",
        "**/*.d.ts",
        "tests/**",
        "e2e/**",
        "**/*.{test,spec}.{ts,tsx}",
        "**/*.config.{js,mjs,cjs,ts,mts,cts}",
        "**/generated/**",
        ".next/**",
        "coverage/**",
      ],
      // 比当前覆盖率低约 3 个百分点：现有测试可以通过，明显回退会失败。
      thresholds: {
        lines: 87,
        statements: 84,
        functions: 83,
        branches: 77,
      },
    },
  },
});
