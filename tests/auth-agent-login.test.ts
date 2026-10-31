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
  requireOwner: async () => ({
    user: { id: "owner-1", email: "owner@example.com" },
  }),
}));

import { GET, POST } from "@/app/auth/agent-login/route";
import { createAgentLoginLink } from "@/app/(admin)/settings/actions";

describe("Agent 专属口令登录 (/auth/agent-login)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    generateLink.mockReset();
    verifyOtp.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("未配置 AGENT_LOGIN_TOKEN 时返回 404", async () => {
    vi.stubEnv("AGENT_LOGIN_TOKEN", "");
    const res = await GET(new NextRequest("https://www.bingetrack.ing/auth/agent-login?token=any"));
    expect(res.status).toBe(404);
  });

  it("口令缺失或错误时返回 401 且不调用 Supabase", async () => {
    vi.stubEnv("AGENT_LOGIN_TOKEN", "correct-horse-battery-staple");

    const missingRes = await GET(new NextRequest("https://www.bingetrack.ing/auth/agent-login"));
    expect(missingRes.status).toBe(401);

    const wrongRes = await GET(new NextRequest("https://www.bingetrack.ing/auth/agent-login?token=wrong-token"));
    expect(wrongRes.status).toBe(401);
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("口令正确但缺少 Supabase 站长配置时返回 500", async () => {
    vi.stubEnv("AGENT_LOGIN_TOKEN", "agent-secret-token");
    vi.stubEnv("OWNER_EMAIL", "");
    const res = await GET(new NextRequest("https://www.bingetrack.ing/auth/agent-login?token=agent-secret-token"));
    expect(res.status).toBe(500);
  });

  it("生产环境中通过查询参数口令验证后签发会话并 303 重定向到 /manage", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AGENT_LOGIN_TOKEN", "agent-secret-token");
    vi.stubEnv("OWNER_EMAIL", "owner@example.com");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");

    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "mock-token-456" } },
      error: null,
    });
    verifyOtp.mockResolvedValue({ error: null });

    const res = await GET(
      new NextRequest("https://www.bingetrack.ing/auth/agent-login?token=agent-secret-token"),
    );

    expect(generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "owner@example.com",
    });
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "mock-token-456",
      type: "magiclink",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/manage");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("支持通过 POST JSON 或 Authorization Bearer 头提交口令并跳转安全 next 路径", async () => {
    vi.stubEnv("AGENT_LOGIN_TOKEN", "agent-secret-token");
    vi.stubEnv("OWNER_EMAIL", "owner@example.com");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");

    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "mock-token-789" } },
      error: null,
    });
    verifyOtp.mockResolvedValue({ error: null });

    const postJsonRes = await POST(
      new NextRequest("https://www.bingetrack.ing/auth/agent-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "agent-secret-token", next: "/settings" }),
      }),
    );
    expect(postJsonRes.status).toBe(303);
    expect(postJsonRes.headers.get("location")).toBe("/settings");

    const bearerRes = await GET(
      new NextRequest("https://www.bingetrack.ing/auth/agent-login?next=https://evil.com", {
        headers: { Authorization: "Bearer agent-secret-token" },
      }),
    );
    expect(bearerRes.status).toBe(303);
    expect(bearerRes.headers.get("location")).toBe("/manage");
  });

  it("在 /settings 后台通过 createAgentLoginLink 生成用完即焚的一次性登录链接", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");

    generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "one-time-hash-999" } },
      error: null,
    });

    const result = await createAgentLoginLink();
    expect(generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "owner@example.com",
    });
    expect(result.error).toBeUndefined();
    expect(result.url).toContain("/auth/confirm?token_hash=one-time-hash-999&type=magiclink&next=%2Fmanage");
  });
});

