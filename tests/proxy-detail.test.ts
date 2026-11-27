// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "@/proxy";

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: vi.fn() } }),
}));

const id = "03cad04d-b4be-4930-b3de-8e58a4eda9ef";
const seasonId = "50000000-0000-4000-8000-000000000003";
const matches = (url: string) => unstable_doesMiddlewareMatch({ config, nextConfig: {}, url });

describe("详情路由的非法 ID", () => {
  it("合法 UUID 详情页不经过 proxy，保持直接命中 ISR 缓存", () => {
    for (const url of [
      `/movies/${id}`,
      `/shows/${id}`,
      `/albums/${id}`,
      `/books/${id}`,
      `/music/${id}`,
      `/people/${id}`,
      `/shows/${id.toUpperCase()}`,
      `/shows/${id}/seasons/${id}`,
      "/movies",
      "/shows",
      "/albums",
      "/books",
      "/music",
      "/people",
    ]) {
      expect(matches(url), url).toBe(false);
    }
  });

  it("非 UUID 的详情路径进入 proxy", () => {
    for (const url of [
      "/movies/wp-login.php",
      "/movies/123",
      `/movies/${id}x`,
      "/shows/old-slug",
      "/shows/old-slug/seasons/1",
      "/albums/old-slug",
      "/books/wp-login.php",
      `/albums/${id}x`,
      `/books/${id}x`,
      "/music/wp-login.php",
      "/music/abc",
      `/music/${id}x`,
      "/people/abc",
      "/people/wp-login.php",
      `/people/${id}x`,
    ]) {
      expect(matches(url), url).toBe(true);
    }
  });

  it("非法 ID 在渲染前返回 404，不进入页面", async () => {
    for (const url of [
      "/movies/wp-login.php",
      "/shows/old-slug",
      "/albums/not-a-uuid",
      "/books/123",
      "/music/wp-login.php",
      "/music/abc",
      "/people/abc",
      "/people/not-a-uuid",
    ]) {
      const response = await proxy(new NextRequest(`https://www.bingetrack.ing${url}`));
      expect(response.status, url).toBe(404);
      expect(response.headers.get("x-middleware-next"), url).toBeNull();
    }
  });

  it("歌曲与人物：合法 UUID 不进 proxy；畸形 ID 在渲染前 404", async () => {
    for (const url of [`/music/${id}`, `/people/${id}`, `/music/${id.toUpperCase()}`, `/people/${id.toUpperCase()}`]) {
      expect(matches(url), url).toBe(false);
    }
    // 合法 UUID 即使误入 proxy 也不应 404（matcher 本就不会命中）
    for (const url of [`/music/${id}`, `/people/${id}`]) {
      const response = await proxy(new NextRequest(`https://www.bingetrack.ing${url}`));
      expect(response.status, url).toBe(200);
      expect(response.headers.get("x-middleware-next"), url).toBe("1");
    }
    for (const url of ["/music/wp-login.php", "/music/abc", "/people/abc", `/people/${id}x`]) {
      expect(matches(url), url).toBe(true);
      const response = await proxy(new NextRequest(`https://www.bingetrack.ing${url}`));
      expect(response.status, url).toBe(404);
      expect(response.headers.get("x-middleware-next"), url).toBeNull();
    }
  });

  it("合法的季 UUID 通过校验，不经过 proxy", async () => {
    for (const url of [
      `/shows/${id}/seasons/${id}`,
      `/shows/${id}/seasons/${seasonId}`,
      `/shows/${id}/seasons/${seasonId.toUpperCase()}`,
      `/shows/${id.toUpperCase()}/seasons/${seasonId}`,
    ]) {
      expect(matches(url), url).toBe(false);
    }

    const response = await proxy(new NextRequest(`https://www.bingetrack.ing/shows/${id}/seasons/${seasonId}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("非 UUID 的季 ID 在渲染前返回 404", async () => {
    for (const url of [
      `/shows/${id}/seasons/1`,
      `/shows/${id}/seasons/not-a-uuid`,
      `/shows/${id}/seasons/${seasonId}x`,
      `/shows/${id}/seasons/wp-login.php`,
      `/shows/${id}/seasons/1?page=2&status=watched`,
    ]) {
      expect(matches(url), url).toBe(true);
      const response = await proxy(new NextRequest(`https://www.bingetrack.ing${url}`));
      expect(response.status, url).toBe(404);
      expect(response.headers.get("x-middleware-next"), url).toBeNull();
    }
  });

  it("节目 ID 的校验保持不变", async () => {
    for (const url of [
      `/movies/${id}`,
      `/shows/${id}`,
      `/albums/${id}`,
      `/books/${id}`,
      `/shows/${id.toUpperCase()}`,
      "/movies",
      "/shows",
      "/albums",
      "/books",
    ]) {
      expect(matches(url), url).toBe(false);
    }
    for (const url of [
      "/movies/wp-login.php",
      "/movies/123",
      `/movies/${id}x`,
      "/shows/old-slug",
      `/shows/old-slug/seasons/${seasonId}`,
      "/albums/old-slug",
      "/books/123",
    ]) {
      expect(matches(url), url).toBe(true);
    }

    const response = await proxy(new NextRequest("https://www.bingetrack.ing/shows/old-slug"));
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-next")).toBeNull();
    const movie = await proxy(new NextRequest("https://www.bingetrack.ing/movies/wp-login.php"));
    expect(movie.status).toBe(404);
    expect(movie.headers.get("x-middleware-next")).toBeNull();
    const album = await proxy(new NextRequest("https://www.bingetrack.ing/albums/old-slug"));
    expect(album.status).toBe(404);
    expect(album.headers.get("x-middleware-next")).toBeNull();
    const book = await proxy(new NextRequest("https://www.bingetrack.ing/books/123"));
    expect(book.status).toBe(404);
    expect(book.headers.get("x-middleware-next")).toBeNull();
  });

  it("管理路径仍按原逻辑刷新会话并禁止缓存", async () => {
    const response = await proxy(new NextRequest("https://www.bingetrack.ing/manage"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("确认页禁止缓存并标记 noindex，且不写入会话 Cookie", async () => {
    const response = await proxy(
      new NextRequest("https://www.bingetrack.ing/auth/confirm?type=magiclink&token_hash=test"),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("POST /auth/confirm 改写到验证路由", async () => {
    const response = await proxy(new NextRequest("https://www.bingetrack.ing/auth/confirm", { method: "POST" }));
    expect(response.headers.get("x-middleware-rewrite")).toContain("/auth/confirm/verify");
    expect(response.headers.get("x-middleware-next")).toBeNull();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
