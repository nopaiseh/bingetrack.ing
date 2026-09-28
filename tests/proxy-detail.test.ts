// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "@/proxy";

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: vi.fn() } }),
}));

const id = "03cad04d-b4be-4930-b3de-8e58a4eda9ef";
const matches = (url: string) => unstable_doesMiddlewareMatch({ config, nextConfig: {}, url });

describe("详情路由的非法 ID", () => {
  it("合法 UUID 详情页不经过 proxy，保持直接命中 ISR 缓存", () => {
    for (const url of [`/movies/${id}`, `/shows/${id}`, `/shows/${id.toUpperCase()}`, `/shows/${id}/seasons/${id}`, "/movies", "/shows"]) {
      expect(matches(url), url).toBe(false);
    }
  });

  it("非 UUID 的详情路径进入 proxy", () => {
    for (const url of ["/movies/wp-login.php", "/movies/123", `/movies/${id}x`, "/shows/old-slug", "/shows/old-slug/seasons/1"]) {
      expect(matches(url), url).toBe(true);
    }
  });

  it("非法 ID 在渲染前返回 404，不进入页面", async () => {
    const response = await proxy(new NextRequest("https://www.bingetrack.ing/movies/wp-login.php"));
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-next")).toBeNull();
  });

  it("管理路径仍按原逻辑刷新会话并禁止缓存", async () => {
    const response = await proxy(new NextRequest("https://www.bingetrack.ing/manage"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
