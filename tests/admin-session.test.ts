import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generateLink, verifyOtp, createClient } = vi.hoisted(() => ({
  generateLink: vi.fn(),
  verifyOtp: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient,
}));

vi.mock("@/lib/auth/server", () => ({
  getAuthServer: async () => ({
    auth: { verifyOtp },
  }),
}));

import { createAdminSession, generateAdminMagicLink } from "@/lib/auth/admin-session";

const SUPABASE_URL = "https://example.supabase.co";
const EMAIL = "owner@example.com";

function stubAdminEnv(overrides: Record<string, string> = {}) {
  vi.stubEnv("SUPABASE_SECRET_KEY", overrides.SUPABASE_SECRET_KEY ?? "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", overrides.SUPABASE_SERVICE_ROLE_KEY ?? "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", overrides.NEXT_PUBLIC_SUPABASE_URL ?? SUPABASE_URL);
}

describe("运维密钥会话", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    generateLink.mockReset();
    verifyOtp.mockReset();
    createClient.mockReset();
    createClient.mockImplementation(() => ({
      auth: { admin: { generateLink } },
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("优先使用 SUPABASE_SECRET_KEY，并关闭会话持久化", async () => {
    stubAdminEnv({
      SUPABASE_SECRET_KEY: "  secret-key  ",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "hash-1" } },
      error: null,
    });

    const result = await generateAdminMagicLink(EMAIL);

    expect(result).toEqual({ ok: true, hashedToken: "hash-1" });
    expect(createClient).toHaveBeenCalledWith(SUPABASE_URL, "secret-key", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(generateLink).toHaveBeenCalledWith({ type: "magiclink", email: EMAIL });
  });

  it("SECRET_KEY 为空或只有空白时改用 SUPABASE_SERVICE_ROLE_KEY", async () => {
    stubAdminEnv({
      SUPABASE_SECRET_KEY: "   ",
      SUPABASE_SERVICE_ROLE_KEY: "  service-role-key  ",
    });
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "hash-2" } },
      error: null,
    });

    await generateAdminMagicLink(EMAIL);

    expect(createClient).toHaveBeenCalledWith(SUPABASE_URL, "service-role-key", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it.each([
    { SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL },
    { SUPABASE_SECRET_KEY: "secret", SUPABASE_SERVICE_ROLE_KEY: "", NEXT_PUBLIC_SUPABASE_URL: "" },
    { SUPABASE_SECRET_KEY: "   ", SUPABASE_SERVICE_ROLE_KEY: "  ", NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL },
  ])("配置不齐时不创建客户端：%o", async (env) => {
    stubAdminEnv(env);

    const link = await generateAdminMagicLink(EMAIL);
    const session = await createAdminSession(EMAIL);

    expect(link).toEqual({ ok: false, reason: "missing_config" });
    expect(session).toEqual({ ok: false, reason: "missing_config" });
    expect(createClient).not.toHaveBeenCalled();
    expect(generateLink).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("generateLink 失败时返回错误信息，不调用 verifyOtp", async () => {
    stubAdminEnv({ SUPABASE_SECRET_KEY: "secret" });
    generateLink.mockResolvedValue({
      data: { properties: null },
      error: { message: "user missing" },
    });

    const result = await generateAdminMagicLink(EMAIL);

    expect(result).toEqual({ ok: false, reason: "generate_failed", message: "user missing" });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("没有 hashed_token 或错误信息为空时使用原来的失败文案", async () => {
    stubAdminEnv({ SUPABASE_SERVICE_ROLE_KEY: "role" });
    generateLink.mockResolvedValueOnce({
      data: { properties: {} },
      error: null,
    });
    generateLink.mockResolvedValueOnce({
      data: { properties: null },
      error: { message: "" },
    });

    await expect(generateAdminMagicLink(EMAIL)).resolves.toEqual({
      ok: false,
      reason: "generate_failed",
      message: "无法生成凭据",
    });
    await expect(generateAdminMagicLink(EMAIL)).resolves.toEqual({
      ok: false,
      reason: "generate_failed",
      message: "无法生成凭据",
    });
  });

  it("空白邮箱视为配置缺失，不调用 Supabase", async () => {
    stubAdminEnv({ SUPABASE_SECRET_KEY: "secret" });

    await expect(createAdminSession(undefined)).resolves.toEqual({ ok: false, reason: "missing_config" });
    await expect(createAdminSession("   ")).resolves.toEqual({ ok: false, reason: "missing_config" });
    expect(createClient).not.toHaveBeenCalled();
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("会话入口会 trim 邮箱后再生成链接", async () => {
    stubAdminEnv({ SUPABASE_SECRET_KEY: "secret" });
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "hash-trimmed" } },
      error: null,
    });
    verifyOtp.mockResolvedValue({ error: null });

    await createAdminSession("  owner@example.com  ");

    expect(generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "owner@example.com",
    });
  });

  it("一次性链接入口把邮箱原样传给 generateLink", async () => {
    stubAdminEnv({ SUPABASE_SECRET_KEY: "secret" });
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "hash-3" } },
      error: null,
    });

    await generateAdminMagicLink("  Owner@Example.com  ");

    expect(generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "  Owner@Example.com  ",
    });
  });

  it("generateLink 抛错时继续向外抛，让调用方决定如何处理", async () => {
    stubAdminEnv({ SUPABASE_SECRET_KEY: "secret" });
    generateLink.mockRejectedValue(new Error("network"));

    await expect(generateAdminMagicLink(EMAIL)).rejects.toThrow("network");
    await expect(createAdminSession(EMAIL)).rejects.toThrow("network");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("凭证有效时用 hashed_token 完成 verifyOtp", async () => {
    stubAdminEnv({ SUPABASE_SECRET_KEY: "secret" });
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "hash-session" } },
      error: null,
    });
    verifyOtp.mockResolvedValue({ error: null });

    const result = await createAdminSession(EMAIL);

    expect(result).toEqual({ ok: true });
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash-session",
      type: "magiclink",
    });
  });

  it("verifyOtp 失败时返回其 message，不再签发成功", async () => {
    stubAdminEnv({ SUPABASE_SECRET_KEY: "secret" });
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "hash-session" } },
      error: null,
    });
    verifyOtp.mockResolvedValue({ error: { message: "otp expired" } });

    const result = await createAdminSession(EMAIL);

    expect(result).toEqual({ ok: false, reason: "verify_failed", message: "otp expired" });
  });

  it("链接生成失败时不会 verifyOtp", async () => {
    stubAdminEnv({ SUPABASE_SECRET_KEY: "secret" });
    generateLink.mockResolvedValue({
      data: { properties: null },
      error: { message: "rate limit" },
    });

    const result = await createAdminSession(EMAIL);

    expect(result).toEqual({ ok: false, reason: "generate_failed", message: "rate limit" });
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
