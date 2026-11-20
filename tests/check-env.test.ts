import { describe, expect, it, vi } from "vitest";
import {
  environmentCheckMessages,
  missingProductionActivitySecretNames,
  missingRequiredVariables,
  runEnvironmentCheck,
} from "../scripts/check-env.mjs";

type EnvMap = Record<string, string | undefined>;

const base: EnvMap = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("missingProductionActivitySecretNames", () => {
  it("非生产不强制签名密钥", () => {
    expect(missingProductionActivitySecretNames({ ...base, VERCEL_ENV: "preview" })).toEqual([]);
    expect(missingProductionActivitySecretNames({ ...base })).toEqual([]);
  });

  it("生产缺少两个密钥时返回变量名", () => {
    expect(
      missingProductionActivitySecretNames({
        ...base,
        VERCEL_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://www.bingetrack.ing",
        SUPABASE_SECRET_KEY: "  ",
        SUPABASE_SERVICE_ROLE_KEY: "",
      }),
    ).toEqual(["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);
  });

  it("生产只要有一个非空白密钥即通过", () => {
    expect(
      missingProductionActivitySecretNames({
        ...base,
        VERCEL_ENV: "production",
        SUPABASE_SECRET_KEY: "secret",
      }),
    ).toEqual([]);
    expect(
      missingProductionActivitySecretNames({
        ...base,
        VERCEL_ENV: "production",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      }),
    ).toEqual([]);
  });
});

describe("environmentCheckMessages / runEnvironmentCheck", () => {
  it("生产缺密钥时错误文案只含变量名、不含值", () => {
    const secretValue = "super-secret-value-do-not-leak";
    const messages = environmentCheckMessages({
      ...base,
      VERCEL_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://www.bingetrack.ing",
    });
    expect(messages.some((message) => message.includes("SUPABASE_SECRET_KEY"))).toBe(true);
    expect(messages.some((message) => message.includes("SUPABASE_SERVICE_ROLE_KEY"))).toBe(true);
    expect(messages.join("\n")).not.toContain(secretValue);

    const io = { error: vi.fn(), log: vi.fn() };
    expect(
      runEnvironmentCheck(
        {
          ...base,
          VERCEL_ENV: "production",
          NEXT_PUBLIC_SITE_URL: "https://www.bingetrack.ing",
          SUPABASE_SECRET_KEY: secretValue,
        },
        io,
      ),
    ).toBe(0);
    expect(io.error).not.toHaveBeenCalled();
    expect(JSON.stringify(io.log.mock.calls)).not.toContain(secretValue);
  });

  it("生产缺 NEXT_PUBLIC_SITE_URL 仍会列出", () => {
    expect(missingRequiredVariables({ ...base, VERCEL_ENV: "production" })).toContain("NEXT_PUBLIC_SITE_URL");
  });

  it("预览环境有基础变量即可通过", () => {
    const io = { error: vi.fn(), log: vi.fn() };
    expect(runEnvironmentCheck({ ...base, VERCEL_ENV: "preview" }, io)).toBe(0);
    expect(io.error).not.toHaveBeenCalled();
  });
});
