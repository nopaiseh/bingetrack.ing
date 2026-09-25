import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import * as route from "@/app/api/revalidate/route";
import { revalidatePath, revalidateTag } from "next/cache";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

/** 构造带可选 Authorization 头的 POST 请求。 */
function post(authorization?: string) {
  return new NextRequest("http://localhost:3000/api/revalidate", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

describe("/api/revalidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVALIDATE_SECRET = "my-secret-token";
  });

  it("不导出 GET，避免跨站链接或图片触发刷新", () => {
    expect("GET" in route).toBe(false);
  });

  it("缺少凭证时返回 401", async () => {
    const res = await route.POST(post());
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("凭证错误时返回 401", async () => {
    const res = await route.POST(post("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("未配置密钥时拒绝所有请求", async () => {
    delete process.env.REVALIDATE_SECRET;
    const res = await route.POST(post("Bearer "));
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("查询参数中的密钥不再被接受", async () => {
    const req = new NextRequest("http://localhost:3000/api/revalidate?secret=my-secret-token", { method: "POST" });
    const res = await route.POST(req);
    expect(res.status).toBe(401);
  });

  it("Bearer 凭证正确时刷新缓存", async () => {
    const res = await route.POST(post("Bearer my-secret-token"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.revalidated).toBe(true);
    expect(revalidateTag).toHaveBeenCalledWith("media", { expire: 0 });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});
