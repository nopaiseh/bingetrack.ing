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

const ORIGIN = "https://www.bingetrack.ing";
const TOKEN = "agent-secret-token";

function agentRequest(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(new URL(path, ORIGIN), init);
}

function bearerPost(token: string, path = "/auth/agent-login") {
  return agentRequest(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

function enableOwnerConfig() {
  vi.stubEnv("OWNER_EMAIL", "owner@example.com");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
}

function mockSession(hashedToken = "mock-token-456") {
  generateLink.mockResolvedValue({
    data: { properties: { hashed_token: hashedToken } },
    error: null,
  });
  verifyOtp.mockResolvedValue({ error: null });
}

describe("Agent 专属口令登录 (/auth/agent-login)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    generateLink.mockReset();
    verifyOtp.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("未配置 AGENT_LOGIN_TOKEN 时 GET 与 POST 都返回 404", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AGENT_LOGIN_TOKEN", "");

    const getRes = await GET(agentRequest("/auth/agent-login?token=any"));
    const postRes = await POST(bearerPost("any"));

    vi.stubEnv("AGENT_LOGIN_TOKEN", "   ");
    const blankRes = await POST(bearerPost(TOKEN));

    expect(getRes.status).toBe(404);
    expect(postRes.status).toBe(404);
    expect(blankRes.status).toBe(404);
    expect(generateLink).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("错误、缺失或非 Bearer 的口令返回 401 且不调用 Supabase", async () => {
    vi.stubEnv("AGENT_LOGIN_TOKEN", "correct-horse-battery-staple");

    const missingRes = await POST(agentRequest("/auth/agent-login", { method: "POST" }));
    const wrongRes = await POST(bearerPost("wrong-token"));
    const shortRes = await POST(bearerPost("x"));
    const longRes = await POST(bearerPost("correct-horse-battery-staple-extra"));
    const basicRes = await POST(
      agentRequest("/auth/agent-login", {
        method: "POST",
        headers: { Authorization: "Basic YWdlbnQ6c2VjcmV0" },
      }),
    );
    const jsonRes = await POST(
      agentRequest("/auth/agent-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "correct-horse-battery-staple" }),
      }),
    );

    expect(missingRes.status).toBe(401);
    expect(wrongRes.status).toBe(401);
    expect(shortRes.status).toBe(401);
    expect(longRes.status).toBe(401);
    expect(basicRes.status).toBe(401);
    expect(jsonRes.status).toBe(401);
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("查询参数中的口令一律拒绝，即使同时带了正确的 Bearer", async () => {
    vi.stubEnv("AGENT_LOGIN_TOKEN", TOKEN);
    enableOwnerConfig();
    mockSession();

    const queryOnly = await POST(agentRequest(`/auth/agent-login?token=${TOKEN}`, { method: "POST" }));
    const queryAndBearer = await POST(
      agentRequest("/auth/agent-login?Token=agent-secret-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}` },
      }),
    );
    const getWithQuery = await GET(
      agentRequest(`/auth/agent-login?token=${TOKEN}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      }),
    );

    expect(queryOnly.status).toBe(401);
    expect(queryAndBearer.status).toBe(401);
    expect(getWithQuery.status).toBe(405);
    expect(getWithQuery.headers.get("allow")).toBe("POST");
    expect(queryOnly.headers.get("location")).toBeNull();
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("已配置口令时 GET 返回 405，不签发会话", async () => {
    vi.stubEnv("AGENT_LOGIN_TOKEN", TOKEN);
    enableOwnerConfig();
    mockSession();

    const res = await GET(
      agentRequest("/auth/agent-login", {
        headers: { Authorization: `Bearer ${TOKEN}` },
      }),
    );

    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("Authorization Bearer 正确时签发会话并 303 到安全的 next 路径", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AGENT_LOGIN_TOKEN", TOKEN);
    enableOwnerConfig();
    mockSession();

    const res = await POST(bearerPost(TOKEN));

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

    const settingsRes = await POST(bearerPost(TOKEN, "/auth/agent-login?next=/settings"));
    expect(settingsRes.status).toBe(303);
    expect(settingsRes.headers.get("location")).toBe("/settings");

    const evilRes = await POST(bearerPost(TOKEN, "/auth/agent-login?next=https://evil.com"));
    expect(evilRes.headers.get("location")).toBe("/manage");

    const protocolRelative = await POST(bearerPost(TOKEN, "/auth/agent-login?next=//evil.com"));
    expect(protocolRelative.headers.get("location")).toBe("/manage");
  });

  it("口令正确但缺少 Supabase 站长配置时返回 500", async () => {
    vi.stubEnv("AGENT_LOGIN_TOKEN", TOKEN);
    vi.stubEnv("OWNER_EMAIL", "");

    const res = await POST(bearerPost(TOKEN));

    expect(res.status).toBe(500);
    expect(generateLink).not.toHaveBeenCalled();
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
