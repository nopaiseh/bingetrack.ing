import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, rpc, redirect } = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })) }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn(() => ({ auth: { getUser }, rpc })) }));

import { requireOwner } from "@/lib/auth/server";

describe("服务端站长权限", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("无会话时跳转登录且不执行权限 RPC", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireOwner()).rejects.toThrow("REDIRECT:/login");
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([{ data: false, error: null }, { data: null, error: { code: "PGRST202" } }, { data: "true", error: null }])("非站长、配置缺失或错误响应均拒绝", async result => {
    getUser.mockResolvedValue({ data: { user: { id: "outsider" } }, error: null });
    rpc.mockResolvedValue(result);
    await expect(requireOwner()).rejects.toThrow("REDIRECT:/login?error=access");
  });
  it("只有经过 Auth 验证且数据库确认为站长的账号能通过", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
    rpc.mockResolvedValue({ data: true, error: null });
    expect((await requireOwner()).user.id).toBe("owner");
    expect(rpc).toHaveBeenCalledWith("is_site_owner");
  });
});
