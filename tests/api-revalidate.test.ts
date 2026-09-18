import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/revalidate/route";
import { requireOwner } from "@/lib/auth/server";
import { revalidatePath, revalidateTag } from "next/cache";

vi.mock("@/lib/auth/server", () => ({
  requireOwner: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

describe("/api/revalidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REVALIDATE_SECRET;
  });

  it("无凭证且未登录时返回 401", async () => {
    vi.mocked(requireOwner).mockRejectedValue(new Error("Unauthorized"));
    const req = new NextRequest("http://localhost:3000/api/revalidate");
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("已登录站长时成功刷新缓存", async () => {
    vi.mocked(requireOwner).mockResolvedValue({} as never);
    const req = new NextRequest("http://localhost:3000/api/revalidate");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.revalidated).toBe(true);
    expect(revalidateTag).toHaveBeenCalledWith("media", { expire: 0 });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("带正确 secret 时成功刷新缓存，支持 POST 请求", async () => {
    process.env.REVALIDATE_SECRET = "my-secret-token";
    vi.mocked(requireOwner).mockRejectedValue(new Error("Unauthorized"));
    const req = new NextRequest("http://localhost:3000/api/revalidate?secret=my-secret-token", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.revalidated).toBe(true);
    expect(revalidateTag).toHaveBeenCalledWith("media", { expire: 0 });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

