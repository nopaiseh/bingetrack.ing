// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { verifyOtp, cookieSet } = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  cookieSet: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getAuthServer: async () => {
    const { cookies } = await import("next/headers");
    return {
      auth: {
        verifyOtp: async (input: unknown) => {
          const result = await verifyOtp(input);
          if (!result?.error) (await cookies()).set("sb-test-auth-token", "session");
          return result;
        },
      },
    };
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: cookieSet,
    delete: vi.fn(),
  }),
}));

import { isSameOrigin } from "@/lib/auth/confirm-link";
import { POST } from "@/app/auth/confirm/verify/route";

function postConfirm(fields: Record<string, string>, origin?: string) {
  const headers = new Headers({ "content-type": "application/x-www-form-urlencoded" });
  if (origin !== undefined) headers.set("origin", origin);
  return POST(new NextRequest("http://localhost:3000/auth/confirm", {
    method: "POST",
    headers,
    body: new URLSearchParams(fields).toString(),
  }));
}

describe("一次性登录确认", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    cookieSet.mockReset();
    verifyOtp.mockResolvedValue({ error: null });
    vi.unstubAllEnvs();
  });

  it.each(["magiclink", "invite"])("POST %s 验证后保留浏览器域名并写入会话", async (type) => {
    const response = await postConfirm({ type, token_hash: "test" }, "http://localhost:3000");
    expect(verifyOtp).toHaveBeenCalledWith({ type, token_hash: "test" });
    expect(cookieSet).toHaveBeenCalledWith("sb-test-auth-token", "session");
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location")!, "http://127.0.0.1:3000").href)
      .toBe("http://127.0.0.1:3000/settings");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("验证失败也保留域名，且不写入会话", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("expired") });
    const response = await postConfirm({ type: "magiclink", token_hash: "expired" }, "http://localhost:3000");
    expect(verifyOtp).toHaveBeenCalledWith({ type: "magiclink", token_hash: "expired" });
    expect(cookieSet).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?authError=link");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("支持固定回跳到 /manage 供 Agent 一次性链接直接进入管理台", async () => {
    const response = await postConfirm({ type: "magiclink", token_hash: "test", next: "/manage" }, "http://localhost:3000");
    expect(verifyOtp).toHaveBeenCalledWith({ type: "magiclink", token_hash: "test" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/manage");
  });

  it("无效类型和外部回跳参数不能改变固定目标", async () => {
    const invalidType = await postConfirm({ type: "signup", token_hash: "test", next: "https://example.com" }, "http://localhost:3000");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
    expect(invalidType.headers.get("location")).toBe("/?authError=link");

    const externalNext = await postConfirm({ type: "magiclink", token_hash: "test", next: "https://example.com" }, "http://localhost:3000");
    expect(externalNext.headers.get("location")).toBe("/settings");
    expect(externalNext.headers.get("location")).not.toContain("example.com");
  });

  it("跨站 Origin 被拒绝，且不验证、不写 Cookie", async () => {
    const response = await postConfirm({ type: "magiclink", token_hash: "test", next: "/manage" }, "https://evil.example");
    expect(response.status).toBe(403);
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("缺少 Origin 时同样拒绝", async () => {
    const response = await postConfirm({ type: "magiclink", token_hash: "test" });
    expect(response.status).toBe(403);
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("Origin 为 null 时拒绝，避免 no-referrer 或沙箱页面代提交", async () => {
    const response = await postConfirm({ type: "magiclink", token_hash: "test", next: "/manage" }, "null");
    expect(response.status).toBe(403);
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("规范站点地址与反向代理的内部 origin 不一致时仍接受同一站点", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.bingetrack.ing");
    const request = {
      headers: { get: (name: string) => (name === "origin" ? "https://www.bingetrack.ing" : name === "host" ? "internal.local" : null) },
      nextUrl: { origin: "http://internal.local", protocol: "http:" },
    };
    expect(isSameOrigin(request)).toBe(true);
    expect(isSameOrigin({
      ...request,
      headers: { get: (name: string) => (name === "origin" ? "https://evil.example" : null) },
    })).toBe(false);
  });
});
