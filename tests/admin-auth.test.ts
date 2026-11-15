import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, rpc, redirect, signOut, cookieSet, activityCookie } = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
  cookieSet: vi.fn(),
  activityCookie: { value: undefined as string | undefined },
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    get: (name: string) =>
      name === "bt-activity" && activityCookie.value ? { name, value: activityCookie.value } : undefined,
    set: cookieSet,
  })),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser, signOut }, rpc })),
}));

import { ACTIVITY_COOKIE, readActivitySecret, signActivityCookie } from "@/lib/auth/activity-cookie";
import { requireOwner } from "@/lib/auth/server";

describe("服务端站长权限", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("SUPABASE_SECRET_KEY", "owner-secret");
    activityCookie.value = undefined;
    signOut.mockResolvedValue({ error: null });
  });

  function allowActivity(userId: string) {
    activityCookie.value = signActivityCookie(userId, Date.now(), readActivitySecret()!);
  }

  it("无会话时跳转登录且不执行权限 RPC", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireOwner()).rejects.toThrow("REDIRECT:/");
    expect(rpc).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });
  it.each([
    { data: false, error: null },
    { data: null, error: { code: "PGRST202" } },
    { data: "true", error: null },
  ])("非站长、配置缺失或错误响应均拒绝", async (result) => {
    allowActivity("outsider");
    getUser.mockResolvedValue({ data: { user: { id: "outsider" } }, error: null });
    rpc.mockResolvedValue(result);
    await expect(requireOwner()).rejects.toThrow("REDIRECT:/?authError=access");
    expect(signOut).not.toHaveBeenCalled();
  });
  it("只有经过 Auth 验证、活动 Cookie 有效且数据库确认为站长的账号能通过", async () => {
    allowActivity("owner");
    getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
    rpc.mockResolvedValue({ data: true, error: null });
    expect((await requireOwner()).user.id).toBe("owner");
    expect(rpc).toHaveBeenCalledWith("is_site_owner");
    expect(signOut).not.toHaveBeenCalled();
  });
  it.each([
    { name: "缺失", value: undefined },
    { name: "伪造", value: "v1.owner.1.not-a-signature" },
    { name: "串号", value: "" },
  ])("活动 Cookie $name 时登出并回到首页", async ({ value }) => {
    getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
    activityCookie.value = value === "" ? signActivityCookie("other-user", Date.now(), readActivitySecret()!) : value;
    await expect(requireOwner()).rejects.toThrow("REDIRECT:/");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(cookieSet).toHaveBeenCalledWith(
      ACTIVITY_COOKIE,
      "",
      expect.objectContaining({ maxAge: 0, httpOnly: true, secure: true, sameSite: "lax", path: "/" }),
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it("过期的活动 Cookie 不能进入管理区", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    getUser.mockResolvedValue({ data: { user: { id: "owner", email: "owner@example.com" } }, error: null });
    activityCookie.value = signActivityCookie("owner", Date.now() - 31 * 60 * 1000, readActivitySecret()!);
    await expect(requireOwner()).rejects.toThrow("REDIRECT:/");
    expect(warn).toHaveBeenCalledWith("[requireOwner] idle_expired");
    expect(warn.mock.calls.flat().join(" ")).not.toContain("owner@example.com");
    expect(warn.mock.calls.flat().join(" ")).not.toContain(activityCookie.value);
    warn.mockRestore();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(cookieSet).toHaveBeenCalledWith(ACTIVITY_COOKIE, "", expect.objectContaining({ maxAge: 0 }));
    expect(rpc).not.toHaveBeenCalled();
  });
  it("登出失败时仍然回到首页", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
    signOut.mockRejectedValue(new Error("network"));
    await expect(requireOwner()).rejects.toThrow("REDIRECT:/");
    expect(rpc).not.toHaveBeenCalled();
  });
});
