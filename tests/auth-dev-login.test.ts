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
});
