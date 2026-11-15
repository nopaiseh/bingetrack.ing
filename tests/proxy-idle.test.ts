// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";
import { ACTIVITY_COOKIE, readActivitySecret, signActivityCookie } from "@/lib/auth/activity-cookie";
import { IDLE_TIMEOUT } from "@/lib/auth/idle";
import { proxy } from "@/proxy";

const SECRET = "activity-secret";
const USER = "user-1";

type SetAll = (values: { name: string; value: string; options?: Record<string, unknown> }[]) => void;

const ctx = vi.hoisted(() => ({
  getClaims: vi.fn(),
  signOut: vi.fn(),
  setAll: (() => undefined) as SetAll,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: typeof ctx.setAll } }) => {
    ctx.setAll = options.cookies.setAll;
    return { auth: { getClaims: ctx.getClaims, signOut: ctx.signOut } };
  },
}));

function signed(at: number, user = USER) {
  const key = readActivitySecret();
  if (!key) throw new Error("缺少签名密钥");
  return signActivityCookie(user, at, key);
}

function setCookies(response: NextResponse) {
  return typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie().join("\n") : "";
}

function manageRequest(activity?: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  const request = new NextRequest("https://www.bingetrack.ing/manage", init);
  request.cookies.set("sb-ref-auth-token", "session");
  if (activity) request.cookies.set(ACTIVITY_COOKIE, activity);
  return request;
}

describe("proxy 空闲期限", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("SUPABASE_SECRET_KEY", SECRET);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    ctx.getClaims.mockReset();
    ctx.signOut.mockReset();
    ctx.signOut.mockResolvedValue({ error: null });
    ctx.getClaims.mockImplementation(async () => {
      ctx.setAll([{ name: "sb-ref-auth-token", value: "refreshed", options: { path: "/" } }]);
      return { data: { claims: { sub: USER } }, error: null };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("活动超过 30 分钟后再请求 /manage 会登出并回到首页，且不写活动 Cookie", async () => {
    const request = manageRequest(signed(Date.now() - IDLE_TIMEOUT));
    const response = await proxy(request);

    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location")!, "https://www.bingetrack.ing").pathname).toBe("/");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(ctx.signOut).toHaveBeenCalledWith({ scope: "local" });
    const header = setCookies(response);
    expect(header).toMatch(/sb-ref-auth-token=;/);
    expect(header).toMatch(/bt-activity=;/);
    expect(header.toLowerCase()).toContain("max-age=0");
    expect(header).not.toContain("bt-activity=v1.");
    expect(header).not.toContain("refreshed");
  });

  it("签名无效、用户不匹配、缺少 Cookie 或没有密钥时同样登出", async () => {
    const forged = signed(Date.now()).slice(0, -1) + "x";
    const cases = [forged, signed(Date.now(), "other-user"), undefined];
    for (const activity of cases) {
      ctx.signOut.mockClear();
      const response = await proxy(manageRequest(activity));
      expect(response.status).toBe(303);
      expect(new URL(response.headers.get("location")!, "https://www.bingetrack.ing").pathname).toBe("/");
      expect(setCookies(response)).toMatch(/bt-activity=;/);
      expect(setCookies(response)).not.toContain("bt-activity=v1.");
    }

    const stillSigned = signed(Date.now());
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", " ");
    const unsigned = await proxy(manageRequest(stillSigned));
    expect(unsigned.status).toBe(303);
    expect(setCookies(unsigned)).toMatch(/bt-activity=;/);
    expect(setCookies(unsigned)).not.toContain("bt-activity=v1.");
  });

  it("登录后立刻打开 /manage，活动 Cookie 刚写下时放行", async () => {
    const response = await proxy(manageRequest(signed(Date.now())));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(ctx.signOut).not.toHaveBeenCalled();
  });

  it("令牌刷新不会写成活动，新鲜的 Cookie 可以继续访问", async () => {
    const response = await proxy(manageRequest(signed(Date.now())));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
    const header = setCookies(response);
    expect(header).toContain("sb-ref-auth-token=refreshed");
    expect(header).not.toContain(ACTIVITY_COOKIE);
    expect(ctx.signOut).not.toHaveBeenCalled();
  });

  it("后台预取不会延长活动，超时后的正式请求仍会登出", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const value = signed(Date.now() - 20 * 60 * 1000);
    const headers = {
      cookie: `sb-ref-auth-token=session; ${ACTIVITY_COOKIE}=${value}`,
      rsc: "1",
      "next-router-prefetch": "1",
      purpose: "prefetch",
    };
    const prefetch = await proxy(new NextRequest("https://www.bingetrack.ing/manage", { headers }));
    expect(prefetch.status).toBe(200);
    expect(prefetch.headers.get("location")).toBeNull();
    expect(setCookies(prefetch)).not.toContain(ACTIVITY_COOKIE);

    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    const later = await proxy(
      new NextRequest("https://www.bingetrack.ing/manage", {
        headers: { cookie: headers.cookie, rsc: "1" },
      }),
    );
    expect(later.status).toBe(303);
    expect(new URL(later.headers.get("location")!, "https://www.bingetrack.ing").pathname).toBe("/");
    expect(setCookies(later)).toMatch(/bt-activity=;/);
    expect(setCookies(later)).not.toContain("bt-activity=v1.");
  });

  it("登录和活动上报本身不会因为还没有活动 Cookie 而被打断", async () => {
    for (const [method, path] of [
      ["POST", "/auth/activity"],
      ["POST", "/auth/confirm/verify"],
      ["GET", "/auth/dev-login"],
      ["POST", "/auth/agent-login"],
      ["GET", "/auth/confirm"],
    ] as const) {
      const request = new NextRequest(`https://www.bingetrack.ing${path}`, { method });
      request.cookies.set("sb-ref-auth-token", "session");
      const response = await proxy(request);
      expect(response.status, path).not.toBe(303);
      expect(response.headers.get("location"), path).toBeNull();
      expect(setCookies(response), path).not.toContain(ACTIVITY_COOKIE);
    }
  });

  it("登出接口失败时仍然清掉会话 Cookie", async () => {
    ctx.signOut.mockRejectedValue(new Error("network"));
    const response = await proxy(manageRequest());
    expect(response.status).toBe(303);
    expect(setCookies(response)).toMatch(/sb-ref-auth-token=;/);
    expect(setCookies(response)).toMatch(/bt-activity=;/);
    expect(setCookies(response)).not.toContain("bt-activity=v1.");
  });

  it.each([
    ["next-router-prefetch", "1"],
    ["next-router-prefetch", "2"],
    ["next-router-prefetch", "3"],
    ["next-router-segment-prefetch", "1"],
    ["purpose", "prefetch"],
    ["sec-purpose", "prefetch"],
  ])("预取头 %s=%s 且活动 Cookie 无效时直接拒绝，不登出也不放行", async (name, value) => {
    for (const activity of [undefined, `${signed(Date.now())}tampered`]) {
      ctx.signOut.mockClear();
      const response = await proxy(manageRequest(activity, { headers: { [name]: value } }));
      expect(response.status).toBe(204);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBeNull();
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.text()).toBe("");
      expect(setCookies(response)).toBe("");
      expect(ctx.signOut).not.toHaveBeenCalled();
    }
  });

  it("没有预取头时，缺少活动 Cookie 的 /manage 仍登出并清掉会话", async () => {
    const response = await proxy(manageRequest());
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location")!, "https://www.bingetrack.ing").pathname).toBe("/");
    expect(ctx.signOut).toHaveBeenCalledWith({ scope: "local" });
    const header = setCookies(response);
    expect(header).toMatch(/sb-ref-auth-token=;/);
    expect(header).toMatch(/bt-activity=;/);
    expect(header.toLowerCase()).toContain("max-age=0");
  });

  it("带有效活动 Cookie 的预取仍放行，且不登出", async () => {
    const response = await proxy(
      manageRequest(signed(Date.now()), { headers: { "next-router-prefetch": "1", rsc: "1" } }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
    expect(ctx.signOut).not.toHaveBeenCalled();
  });

  it("伪造的预取头配上无效活动 Cookie 拿不到页面，也不会撤销会话", async () => {
    const response = await proxy(
      manageRequest(`${signed(Date.now())}forged`, {
        headers: { "next-router-prefetch": "1", purpose: "prefetch", "sec-purpose": "prefetch" },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("x-middleware-next")).toBeNull();
    expect(await response.text()).toBe("");
    expect(setCookies(response)).not.toMatch(/sb-|bt-activity/);
    expect(ctx.signOut).not.toHaveBeenCalled();
  });

  it("没有会话时不因为缺少活动 Cookie 而重定向", async () => {
    ctx.getClaims.mockResolvedValue({ data: null, error: new Error("none") });
    const response = await proxy(new NextRequest("https://www.bingetrack.ing/manage"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(ctx.signOut).not.toHaveBeenCalled();
  });
});
