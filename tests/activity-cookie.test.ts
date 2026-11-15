// @vitest-environment node
import { hkdfSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IDLE_TIMEOUT } from "@/lib/auth/idle";
import {
  ACTIVITY_COOKIE,
  ACTIVITY_COOKIE_HKDF_INFO,
  activityCookieOptions,
  readActivitySecret,
  readBackfillAuthenticatedAt,
  readSessionAuthenticatedAt,
  signActivityCookie,
  skipsIdleEnforcement,
  verifyActivityCookie,
  withinFreshSignIn,
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
    const fromSecret = readActivitySecret();
    vi.stubEnv("SUPABASE_SECRET_KEY", "secret-key");
    expect(fromSecret!.equals(readActivitySecret()!)).toBe(true);

    vi.stubEnv("SUPABASE_SECRET_KEY", "   ");
    const fromRole = readActivitySecret();
    expect(fromRole!.equals(fromSecret!)).toBe(false);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    expect(readActivitySecret()!.equals(fromRole!)).toBe(true);

    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", " ");
    expect(readActivitySecret()).toBeNull();
  });

  it("子密钥由 HKDF-SHA256 和固定 info 派生，用原始密钥签名的 Cookie 会被拒绝", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", SECRET);
    const derived = readActivitySecret();
    const expected = Buffer.from(hkdfSync("sha256", SECRET, Buffer.alloc(0), ACTIVITY_COOKIE_HKDF_INFO, 32));
    expect(derived!.equals(expected)).toBe(true);
    expect(ACTIVITY_COOKIE_HKDF_INFO).toBe("bingetrack-idle-cookie-v1");
    expect(derived!.equals(Buffer.from(SECRET))).toBe(false);

    const now = Date.now();
    const raw = signActivityCookie(USER, now, SECRET);
    expect(verifyActivityCookie(raw, USER, now, derived)).toMatchObject({ reason: "signature" });
    expect(verifyActivityCookie(signActivityCookie(USER, now, derived!), USER, now, derived)).toEqual({
      ok: true,
      at: now,
    });
  });

  it("只改时间戳、留下原来的签名时拒绝", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", SECRET);
    const derived = readActivitySecret()!;
    const now = Date.now();
    const value = signActivityCookie(USER, now, derived);
    const [version, id, stamp, signature] = value.split(".");
    const tampered = `${version}.${id}.${Number(stamp) + 1}.${signature}`;
    expect(verifyActivityCookie(tampered, USER, now, derived)).toMatchObject({ reason: "signature" });
  });

  it("补记窗口只认带时间戳的 amr，并且只用服务端时钟", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const recent = Math.floor((now - 30_000) / 1000);
    expect(readSessionAuthenticatedAt([{ method: "webauthn", timestamp: recent }], now)).toBe(recent * 1000);
    expect(
      readSessionAuthenticatedAt(
        [
          { method: "otp", timestamp: recent - 100 },
          { method: "webauthn", timestamp: recent },
        ],
        now,
      ),
    ).toBe(recent * 1000);
    expect(readSessionAuthenticatedAt(["webauthn"], now)).toBeNull();
    expect(
      readSessionAuthenticatedAt([{ method: "webauthn", timestamp: Math.floor(now / 1000) + 120 }], now),
    ).toBeNull();
    expect(withinFreshSignIn(recent * 1000, now)).toBe(true);
    expect(withinFreshSignIn(now - 3 * 60 * 1000, now)).toBe(false);
    expect(withinFreshSignIn(null, now)).toBe(false);
  });

  it("有 amr 时间戳时不用 last_sign_in_at，没有时才回退，并且不看 iat", () => {
    const now = Date.parse("2026-01-01T00:10:00Z");
    const recent = new Date(now - 20_000).toISOString();
    const old = new Date(now - 40 * 60 * 1000).toISOString();
    const oldAmr = [{ method: "passkey", timestamp: Math.floor((now - 40 * 60 * 1000) / 1000) }];
    const freshAmr = [{ method: "passkey", timestamp: Math.floor((now - 20_000) / 1000) }];

    expect(readBackfillAuthenticatedAt(freshAmr, old, now)).toBe(freshAmr[0].timestamp * 1000);
    expect(withinFreshSignIn(readBackfillAuthenticatedAt(freshAmr, old, now), now)).toBe(true);
    expect(withinFreshSignIn(readBackfillAuthenticatedAt(oldAmr, recent, now), now)).toBe(false);
    expect(readBackfillAuthenticatedAt(["passkey"], recent, now)).toBe(Date.parse(recent));
    expect(withinFreshSignIn(readBackfillAuthenticatedAt(["passkey"], recent, now), now)).toBe(true);
    expect(withinFreshSignIn(readBackfillAuthenticatedAt(["passkey"], old, now), now)).toBe(false);
    expect(readBackfillAuthenticatedAt(undefined, undefined, now)).toBeNull();
  });

  it("混合格式的 amr 只用有效时间戳，不回退 last_sign_in_at", () => {
    const now = Date.parse("2026-01-01T00:10:00Z");
    const stamp = Math.floor((now - 40 * 60 * 1000) / 1000);
    const recent = new Date(now - 10_000).toISOString();
    const mixed = ["passkey", { method: "otp" }, { method: "webauthn", timestamp: stamp }, { timestamp: "nope" }];

    expect(readBackfillAuthenticatedAt(mixed, recent, now)).toBe(stamp * 1000);
    expect(withinFreshSignIn(readBackfillAuthenticatedAt(mixed, recent, now), now)).toBe(false);
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
    expect(skipsIdleEnforcement("GET", "/auth/confirm")).toBe(true);
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
