// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { IDLE_TIMEOUT } from "@/lib/auth/idle";
import {
  ACTIVITY_COOKIE,
  activityCookieOptions,
  readActivitySecret,
  signActivityCookie,
  skipsIdleEnforcement,
  verifyActivityCookie,
} from "@/lib/auth/activity-cookie";
import { isStrictSiteOrigin } from "@/lib/auth/site-origin";

const SECRET = "activity-secret";
const USER = "user-1";

describe("活动 Cookie 签名", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("优先使用 SUPABASE_SECRET_KEY，空白时改用 SERVICE_ROLE_KEY，都没有则无法签名", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "  secret-key  ");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    expect(readActivitySecret()).toBe("secret-key");

    vi.stubEnv("SUPABASE_SECRET_KEY", "   ");
    expect(readActivitySecret()).toBe("service-role");

    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", " ");
    expect(readActivitySecret()).toBeNull();
  });

  it("Cookie 选项是 HttpOnly、Secure、SameSite=Lax", () => {
    expect(activityCookieOptions()).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: IDLE_TIMEOUT / 1000,
    });
    expect(ACTIVITY_COOKIE).toBe("bt-activity");
  });

  it("签名绑定用户和时间，伪造、串号、过期和未来时间都拒绝", () => {
    const now = Date.now();
    const value = signActivityCookie(USER, now, SECRET);
    expect(value).not.toContain(SECRET);
    expect(verifyActivityCookie(value, USER, now, SECRET)).toEqual({ ok: true, at: now });

    expect(verifyActivityCookie(undefined, USER, now, SECRET).ok).toBe(false);
    expect(verifyActivityCookie("v1.not-a-token", USER, now, SECRET)).toMatchObject({ reason: "malformed" });
    expect(verifyActivityCookie(`${value}x`, USER, now, SECRET)).toMatchObject({ reason: "signature" });
    expect(verifyActivityCookie(value, "user-2", now, SECRET)).toMatchObject({ reason: "mismatch" });
    expect(verifyActivityCookie(signActivityCookie("user-2", now, SECRET), USER, now, SECRET)).toMatchObject({
      reason: "mismatch",
    });
    expect(verifyActivityCookie(value, USER, now + IDLE_TIMEOUT, SECRET)).toMatchObject({ reason: "expired" });
    expect(
      verifyActivityCookie(signActivityCookie(USER, now + 5 * 60 * 1000, SECRET), USER, now, SECRET),
    ).toMatchObject({
      reason: "malformed",
    });
    expect(verifyActivityCookie(value, USER, now, null)).toMatchObject({ reason: "unconfigured" });
  });

  it("用户 id 含点号时不能签发，避免和 Cookie 分段冲突", () => {
    expect(() => signActivityCookie("bad.id", Date.now(), SECRET)).toThrow(/无法签名/);
  });

  it("只有建立会话的请求可以跳过空闲检查", () => {
    expect(skipsIdleEnforcement("POST", "/auth/activity")).toBe(true);
    expect(skipsIdleEnforcement("POST", "/auth/confirm")).toBe(true);
    expect(skipsIdleEnforcement("POST", "/auth/confirm/verify")).toBe(true);
    expect(skipsIdleEnforcement("GET", "/auth/dev-login")).toBe(true);
    expect(skipsIdleEnforcement("POST", "/auth/agent-login")).toBe(true);
    expect(skipsIdleEnforcement("GET", "/manage")).toBe(false);
    expect(skipsIdleEnforcement("GET", "/auth/activity")).toBe(false);
    expect(skipsIdleEnforcement("POST", "/manage")).toBe(false);
  });
});

describe("活动上报的 Origin", () => {
  function request(origin: string | null, site = "https://www.bingetrack.ing") {
    return {
      headers: { get: (name: string) => (name === "origin" ? origin : null) },
      nextUrl: { origin: site },
    };
  }

  it("必须与本次请求的 origin 完全一致", () => {
    expect(isStrictSiteOrigin(request("https://www.bingetrack.ing"))).toBe(true);
    expect(isStrictSiteOrigin(request("https://bingetrack.ing"))).toBe(false);
    expect(isStrictSiteOrigin(request("https://evil.example"))).toBe(false);
    expect(isStrictSiteOrigin(request("https://www.bingetrack.ing/auth/activity"))).toBe(false);
    expect(isStrictSiteOrigin(request(null))).toBe(false);
    expect(isStrictSiteOrigin(request("null"))).toBe(false);
    expect(isStrictSiteOrigin(request("not a url"))).toBe(false);
  });
});
