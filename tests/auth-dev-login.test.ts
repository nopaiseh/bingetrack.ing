import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { generateLink, verifyOtp } = vi.hoisted(() => ({
  generateLink: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: { generateLink },
    },
  })),
}));

vi.mock("@/lib/auth/server", () => ({
  getAuthServer: async () => ({
    auth: { verifyOtp },
  }),
}));

import { GET } from "@/app/auth/dev-login/route";

describe("开发环境免密登录", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    generateLink.mockReset();
    verifyOtp.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("生产环境中直接返回 404", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await GET(new NextRequest("http://localhost:3000/auth/dev-login"));
    expect(res.status).toBe(404);
  });

  it("开发环境中缺少配置返回 500", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OWNER_EMAIL", "");
    const res = await GET(new NextRequest("http://localhost:3000/auth/dev-login"));
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("开发登录失败：请在 .env.local 中配置 OWNER_EMAIL 和 SUPABASE_SECRET_KEY");
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("只有 SUPABASE_SERVICE_ROLE_KEY 时仍能签发会话", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OWNER_EMAIL", "admin@example.com");
    vi.stubEnv("SUPABASE_SECRET_KEY", "   ");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-service-role");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "role-token" } },
      error: null,
    });
    verifyOtp.mockResolvedValue({ error: null });

    const res = await GET(new NextRequest("http://localhost:3000/auth/dev-login"));

    expect(res.status).toBe(303);
    expect(generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "admin@example.com" });
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "role-token", type: "magiclink" });
  });

  it("生成或验证失败时保留原来的错误前缀", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OWNER_EMAIL", "admin@example.com");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    generateLink.mockResolvedValueOnce({
      data: { properties: null },
      error: { message: "user missing" },
    });

    const linkRes = await GET(new NextRequest("http://localhost:3000/auth/dev-login"));
    expect(linkRes.status).toBe(500);
    expect(await linkRes.text()).toBe("开发登录失败：user missing");

    generateLink.mockResolvedValueOnce({
      data: { properties: { hashed_token: "mock-token-123" } },
      error: null,
    });
    verifyOtp.mockResolvedValueOnce({ error: { message: "otp expired" } });

    const verifyRes = await GET(new NextRequest("http://localhost:3000/auth/dev-login"));
    expect(verifyRes.status).toBe(500);
    expect(await verifyRes.text()).toBe("开发登录验证失败：otp expired");
  });

  it("开发环境中正常生成 token 并完成登录重定向到 /manage", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OWNER_EMAIL", "admin@example.com");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");

    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "mock-token-123" } },
      error: null,
    });
    verifyOtp.mockResolvedValue({ error: null });

    const res = await GET(new NextRequest("http://localhost:3000/auth/dev-login"));
    expect(generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "admin@example.com",
    });
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "mock-token-123",
      type: "magiclink",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/manage");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("支持安全的相对路径 next 参数", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OWNER_EMAIL", "admin@example.com");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");

    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "mock-token-123" } },
      error: null,
    });
    verifyOtp.mockResolvedValue({ error: null });

    const res = await GET(new NextRequest("http://localhost:3000/auth/dev-login?next=/movies"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/movies");
  });

  it("忽略外部或非法 next 参数，默认回到 /manage", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OWNER_EMAIL", "admin@example.com");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");

    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "mock-token-123" } },
      error: null,
    });
    verifyOtp.mockResolvedValue({ error: null });

    const res = await GET(new NextRequest("http://localhost:3000/auth/dev-login?next=https://evil.com"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/manage");
  });

  it.each(["//evil.com", "/%5Cevil.com", "/%5C/evil.com", "/%09/evil.com", "/%0A/evil.com"])("拒绝协议相对的 next 参数 %s", async (next) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OWNER_EMAIL", "admin@example.com");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");

    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "mock-token-123" } },
      error: null,
    });
    verifyOtp.mockResolvedValue({ error: null });

    const res = await GET(new NextRequest(`http://localhost:3000/auth/dev-login?next=${next}`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/manage");
  });
});
