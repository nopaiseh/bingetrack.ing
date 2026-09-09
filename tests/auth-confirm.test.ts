import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { verifyOtp } = vi.hoisted(() => ({ verifyOtp: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({
  getAuthServer: async () => ({ auth: { verifyOtp } }),
}));
import { GET } from "@/app/auth/confirm/route";

describe("初始化登录回跳", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    verifyOtp.mockResolvedValue({ error: null });
  });

  it.each(["magiclink", "invite"])("%s 验证后保留浏览器域名", async (type) => {
    const response = await GET(new NextRequest(`http://localhost:3000/auth/confirm?type=${type}&token_hash=test`));
    expect(verifyOtp).toHaveBeenCalledWith({ type, token_hash: "test" });
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location")!, "http://127.0.0.1:3000").href)
      .toBe("http://127.0.0.1:3000/admin/security");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("验证失败也保留域名", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("expired") });
    const response = await GET(new NextRequest("http://localhost:3000/auth/confirm?type=magiclink&token_hash=expired"));
    expect(response.headers.get("location")).toBe("/login?error=link");
  });

  it("无效类型和外部回跳参数不能改变固定目标", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/auth/confirm?type=signup&token_hash=test&next=https://example.com"));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("/login?error=link");
  });
});
