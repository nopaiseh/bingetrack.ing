// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  ACTIVITY_COOKIE,
  FRESH_SIGN_IN_MS,
  readActivitySecret,
  signActivityCookie,
  verifyActivityCookie,
} from "@/lib/auth/activity-cookie";
import { IDLE_TIMEOUT } from "@/lib/auth/idle";

const SECRET = "activity-secret";
const USER = "user-1";

const { getUser, getClaims, cookieSet, cookieGet, cookiesFn } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getClaims: vi.fn(),
  cookieSet: vi.fn(),
  cookieGet: vi.fn(),
  cookiesFn: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getAuthServer: async () => ({ auth: { getUser, getClaims } }),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesFn,
}));

import { GET, OPTIONS, POST, PUT } from "@/app/auth/activity/route";

const store = new Map<string, string>();

function derived() {
  const key = readActivitySecret();
  if (!key) throw new Error("缺少签名密钥");
  return key;
}

function signedIn(authenticatedAt = Date.now(), id = USER) {
  getUser.mockResolvedValue({
    data: { user: { id, last_sign_in_at: new Date(authenticatedAt).toISOString() } },
    error: null,
  });
  getClaims.mockResolvedValue({
    data: {
      claims: { sub: id, amr: [{ method: "webauthn", timestamp: Math.floor(authenticatedAt / 1000) }] },
    },
    error: null,
  });
}

function activityRequest(origin?: string, method = "POST") {
  const headers = new Headers();
  if (origin !== undefined) headers.set("origin", origin);
  return new NextRequest("https://www.bingetrack.ing/auth/activity", { method, headers });
}

describe("POST /auth/activity", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("SUPABASE_SECRET_KEY", SECRET);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    store.clear();
    getUser.mockReset();
    getClaims.mockReset();
    cookieSet.mockReset();
    cookieGet.mockReset();
    cookiesFn.mockReset();
    cookieGet.mockImplementation((name: string) => {
      const value = store.get(name);
      return value === undefined ? undefined : { name, value };
    });
    cookieSet.mockImplementation((name: string, value: string) => {
      store.set(name, value);
    });
    cookiesFn.mockResolvedValue({ get: cookieGet, set: cookieSet });
    signedIn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("已登录且 Origin 一致时写入 HttpOnly Secure Cookie，并且绑定用户", async () => {
    const response = await POST(activityRequest("https://www.bingetrack.ing"));

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(cookieSet).toHaveBeenCalledWith(
      ACTIVITY_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax", path: "/" }),
    );
    const value = cookieSet.mock.calls[0][1] as string;
    expect(value).not.toContain(SECRET);
    expect(verifyActivityCookie(value, USER, Date.now(), derived())).toMatchObject({ ok: true });
    expect(verifyActivityCookie(value, "other-user", Date.now(), derived())).toMatchObject({ reason: "mismatch" });
  });

  it("未登录返回 401，且不写 Cookie", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(response.status).toBe(401);
    expect(warn).toHaveBeenCalledWith("[auth/activity] 401 no_session");
    expect(cookieSet).not.toHaveBeenCalled();
    expect(cookiesFn).not.toHaveBeenCalled();
    warn.mockRestore();

    getUser.mockResolvedValue({ data: null, error: new Error("expired") });
    const failed = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(failed.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("Origin 必须等于本次请求的站点 origin，否则 403 且不查用户、不写 Cookie", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.bingetrack.ing");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const origin of ["https://evil.example", "https://bingetrack.ing", "null", undefined]) {
      cookieSet.mockClear();
      getUser.mockClear();
      const response = await POST(activityRequest(origin));
      expect(response.status, String(origin)).toBe(403);
      expect(getUser).not.toHaveBeenCalled();
      expect(cookieSet).not.toHaveBeenCalled();
      expect(cookiesFn).not.toHaveBeenCalled();
    }
    expect(warn).toHaveBeenCalledWith("[auth/activity] 403 bad_origin");
    expect(warn.mock.calls.flat().join(" ")).not.toContain("evil.example");
    warn.mockRestore();
  });

  it("非 POST 返回 405，且不写 Cookie", async () => {
    for (const response of [GET(), PUT(), OPTIONS()]) {
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST");
    }
    expect(cookieSet).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("没有签名密钥时失败关闭，不写 Cookie", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", " ");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const response = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(response.status).toBe(503);
    expect(cookieSet).not.toHaveBeenCalled();
    expect(cookiesFn).not.toHaveBeenCalled();
  });

  it("刚登录的缺失 Cookie 可以补记，窗口外的伪造、串号和过期 Cookie 被拒绝且不覆盖", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    signedIn(Date.now() - FRESH_SIGN_IN_MS - 1000);
    const stale = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(stale.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();
    expect(getClaims).toHaveBeenCalled();

    signedIn(Date.now());
    const fresh = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(fresh.status).toBe(204);
    expect(cookieSet).toHaveBeenCalledOnce();

    signedIn(Date.now() - FRESH_SIGN_IN_MS - 1000);
    cookieSet.mockClear();
    store.set(ACTIVITY_COOKIE, signActivityCookie("other-user", Date.now(), derived()));
    const mismatch = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(mismatch.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();
    expect(verifyActivityCookie(store.get(ACTIVITY_COOKIE), USER, Date.now(), derived())).toMatchObject({
      reason: "mismatch",
    });

    store.set(ACTIVITY_COOKIE, `${signActivityCookie(USER, Date.now(), derived())}tampered`);
    const forged = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(forged.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();

    store.set(ACTIVITY_COOKIE, signActivityCookie(USER, Date.now() - IDLE_TIMEOUT, derived()));
    const expired = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(expired.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();
    expect(store.get(ACTIVITY_COOKIE)).toBe(signActivityCookie(USER, Date.now() - IDLE_TIMEOUT, derived()));
  });

  it("新会话的 amr 仍在窗口内时，验不过的旧 Cookie 可以换成当前用户的 Cookie", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:10:00Z"));
    signedIn(Date.now());
    store.set(ACTIVITY_COOKIE, signActivityCookie("other-user", Date.now() - 60_000, derived()));
    const response = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(response.status).toBe(204);
    expect(verifyActivityCookie(store.get(ACTIVITY_COOKIE), USER, Date.now(), derived())).toEqual({
      ok: true,
      at: Date.now(),
    });
    expect(verifyActivityCookie(store.get(ACTIVITY_COOKIE), "other-user", Date.now(), derived()).ok).toBe(false);
  });

  it("amr 带时间戳时用它补记，不看 last_sign_in_at 或 iat", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:10:00Z"));
    const now = Date.now();
    getUser.mockResolvedValue({
      data: { user: { id: USER, last_sign_in_at: new Date(now - 3 * 60 * 60 * 1000).toISOString() } },
      error: null,
    });
    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: USER,
          iat: Math.floor(now / 1000),
          exp: Math.floor(now / 1000) + 3600,
          amr: [{ method: "passkey", timestamp: Math.floor((now - 15_000) / 1000) }],
        },
      },
      error: null,
    });

    const response = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(response.status).toBe(204);
    expect(verifyActivityCookie(store.get(ACTIVITY_COOKIE), USER, now, derived())).toMatchObject({ ok: true });
  });

  it("amr 没有时间戳时才用服务端 last_sign_in_at，窗口外拒绝，并且忽略新鲜的 iat", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:10:00Z"));
    const now = Date.now();
    getUser.mockResolvedValue({
      data: { user: { id: USER, last_sign_in_at: new Date(now - 20_000).toISOString() } },
      error: null,
    });
    getClaims.mockResolvedValue({
      data: { claims: { sub: USER, iat: Math.floor((now - 3 * 60 * 60 * 1000) / 1000), amr: ["passkey"] } },
      error: null,
    });
    const accepted = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(accepted.status).toBe(204);
    expect(cookieSet).toHaveBeenCalledOnce();

    store.clear();
    cookieSet.mockClear();
    getUser.mockResolvedValue({
      data: { user: { id: USER, last_sign_in_at: new Date(now - FRESH_SIGN_IN_MS - 5_000).toISOString() } },
      error: null,
    });
    getClaims.mockResolvedValue({
      data: {
        claims: { sub: USER, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 3600, amr: ["passkey"] },
      },
      error: null,
    });
    const rejected = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(rejected.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("amr 时间戳已超出窗口时，即使 last_sign_in_at 很新也不补记", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:10:00Z"));
    const now = Date.now();
    getUser.mockResolvedValue({
      data: { user: { id: USER, last_sign_in_at: new Date(now - 10_000).toISOString() } },
      error: null,
    });
    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: USER,
          iat: Math.floor(now / 1000),
          amr: [{ method: "passkey", timestamp: Math.floor((now - FRESH_SIGN_IN_MS - 5_000) / 1000) }],
        },
      },
      error: null,
    });

    const response = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(response.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("已经超时的会话不能靠 last_sign_in_at 回退拿到新 Cookie", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T01:00:00Z"));
    const now = Date.now();
    const expired = signActivityCookie(USER, now - IDLE_TIMEOUT, derived());
    store.set(ACTIVITY_COOKIE, expired);
    getUser.mockResolvedValue({
      data: { user: { id: USER, last_sign_in_at: new Date(now - IDLE_TIMEOUT).toISOString() } },
      error: null,
    });
    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: USER,
          iat: Math.floor(now / 1000),
          amr: [{ method: "passkey", timestamp: Math.floor((now - IDLE_TIMEOUT) / 1000) }],
        },
      },
      error: null,
    });

    const withOldAmr = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(withOldAmr.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();
    expect(store.get(ACTIVITY_COOKIE)).toBe(expired);

    getClaims.mockResolvedValue({
      data: { claims: { sub: USER, iat: Math.floor(now / 1000), amr: ["passkey"] } },
      error: null,
    });
    const withFallback = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(withFallback.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();
    expect(store.get(ACTIVITY_COOKIE)).toBe(expired);
  });

  it("getClaims 失败时直接 401，不用 last_sign_in_at 补记", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:10:00Z"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    getUser.mockResolvedValue({
      data: { user: { id: USER, last_sign_in_at: new Date().toISOString(), email: "owner@example.com" } },
      error: null,
    });
    getClaims.mockResolvedValue({ data: null, error: new Error("jwks") });

    const response = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(response.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[auth/activity] 401 claims_error");
    expect(warn.mock.calls.flat().join(" ")).not.toContain("jwks");
    expect(warn.mock.calls.flat().join(" ")).not.toContain("owner@example.com");
    warn.mockRestore();
  });

  it("Passkey 的 amr 是方法加 unix 秒时立刻补记，旧的 last_sign_in_at 不影响，写下的 Cookie 能通过管理区校验", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:10:00Z"));
    const now = Date.now();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    getUser.mockResolvedValue({
      data: {
        user: {
          id: USER,
          email: "owner@example.com",
          last_sign_in_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
        },
      },
      error: null,
    });
    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: USER,
          iat: Math.floor(now / 1000),
          exp: Math.floor(now / 1000) + 3600,
          amr: [{ method: "passkey", timestamp: Math.floor((now - 5_000) / 1000) }],
        },
      },
      error: null,
    });

    const response = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(response.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
    const value = store.get(ACTIVITY_COOKIE);
    expect(verifyActivityCookie(value, USER, now, derived())).toEqual({ ok: true, at: now });
    warn.mockRestore();
  });

  it("Passkey 令牌只有方法名且 last_sign_in_at 仍是上一次登录时，第一次补记返回 401", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:10:00Z"));
    const now = Date.now();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    getUser.mockResolvedValue({
      data: {
        user: {
          id: USER,
          email: "owner@example.com",
          last_sign_in_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
        },
      },
      error: null,
    });
    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: USER,
          iat: Math.floor(now / 1000),
          exp: Math.floor(now / 1000) + 3600,
          amr: [{ method: "passkey" }],
        },
      },
      error: null,
    });

    const response = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(response.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[auth/activity] 401 outside_window amr=passkey:no-ts cookie=missing");
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).not.toContain(USER);
    expect(logged).not.toContain("owner@example.com");
    expect(logged).not.toContain("iat");
    warn.mockRestore();
  });

  it("用户 id 含点号时无法签名，不写 Cookie", async () => {
    signedIn(Date.now(), "bad.id");
    const dotted = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(dotted.status).toBe(503);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("有效 Cookie 可以刷新时间戳", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    store.set(ACTIVITY_COOKIE, signActivityCookie(USER, Date.now() - 60_000, derived()));
    const response = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(response.status).toBe(204);
    expect(verifyActivityCookie(store.get(ACTIVITY_COOKIE), USER, Date.now(), derived())).toEqual({
      ok: true,
      at: Date.now(),
    });
  });
});
