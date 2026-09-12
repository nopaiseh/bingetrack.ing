import { beforeEach, describe, expect, it, vi } from "vitest";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
const jar = vi.hoisted(() => ({ getAll: vi.fn<() => Array<{ name: string; value: string }>>(() => []), delete: vi.fn() }));

vi.mock("@/lib/auth/server", () => ({
  getAuthServer: async () => ({ auth: { signOut } }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => jar,
}));

import { GET, POST } from "@/app/auth/logout/route";

describe("安全登出流程与 Logout CSRF 防护", () => {
  beforeEach(() => {
    signOut.mockReset();
    signOut.mockResolvedValue({ error: null });
    jar.getAll.mockReset().mockReturnValue([]);
    jar.delete.mockReset();
  });

  it("POST 请求执行正常会话清理并安全重定向至首页", async () => {
    const response = await POST();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("POST 请求网络故障时仍清除本地 Cookie", async () => {
    signOut.mockResolvedValue({ error: new Error("network error") });
    jar.getAll.mockReturnValue([
      { name: "sb-project-auth-token.0", value: "abc" },
      { name: "other-cookie", value: "123" },
    ]);
    const response = await POST();
    expect(signOut).toHaveBeenCalled();
    expect(jar.delete).toHaveBeenCalledWith("sb-project-auth-token.0");
    expect(jar.delete).not.toHaveBeenCalledWith("other-cookie");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
  });

  it("GET 请求不触发 signOut，仅作安全重定向以防御 Logout CSRF", async () => {
    const response = await GET();
    expect(signOut).not.toHaveBeenCalled();
    expect(jar.delete).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
