// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  ACTIVITY_COOKIE,
  FRESH_SIGN_IN_MS,
  signActivityCookie,
  verifyActivityCookie,
} from "@/lib/auth/activity-cookie";
import { IDLE_TIMEOUT } from "@/lib/auth/idle";

const SECRET = "activity-secret";
const USER = "user-1";

const { getUser, cookieSet, cookieGet, cookiesFn } = vi.hoisted(() => ({
  getUser: vi.fn(),
  cookieSet: vi.fn(),
  cookieGet: vi.fn(),
  cookiesFn: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getAuthServer: async () => ({ auth: { getUser } }),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesFn,
}));

import { GET, OPTIONS, POST, PUT } from "@/app/auth/activity/route";

const store = new Map<string, string>();

function signedIn(lastSignInAt = new Date().toISOString(), id = USER) {
  getUser.mockResolvedValue({
    data: { user: { id, last_sign_in_at: lastSignInAt } },
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
    expect(verifyActivityCookie(value, USER, Date.now(), SECRET)).toMatchObject({ ok: true });
    expect(verifyActivityCookie(value, "other-user", Date.now(), SECRET)).toMatchObject({ reason: "mismatch" });
  });

  it("未登录返回 401，且不写 Cookie", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(response.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();
    expect(cookiesFn).not.toHaveBeenCalled();

    getUser.mockResolvedValue({ data: null, error: new Error("expired") });
    const failed = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(failed.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("Origin 必须等于本次请求的站点 origin，否则 403 且不查用户、不写 Cookie", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.bingetrack.ing");
    for (const origin of ["https://evil.example", "https://bingetrack.ing", "null", undefined]) {
      cookieSet.mockClear();
      getUser.mockClear();
      const response = await POST(activityRequest(origin));
      expect(response.status, String(origin)).toBe(403);
      expect(getUser).not.toHaveBeenCalled();
      expect(cookieSet).not.toHaveBeenCalled();
      expect(cookiesFn).not.toHaveBeenCalled();
    }
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

  it("刚登录的缺失 Cookie 可以补记，超过窗口或已有坏 Cookie 时拒绝且不覆盖", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    signedIn(new Date(Date.now() - FRESH_SIGN_IN_MS - 1000).toISOString());
    const stale = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(stale.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();

    signedIn(new Date().toISOString());
    const fresh = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(fresh.status).toBe(204);
    expect(cookieSet).toHaveBeenCalledOnce();

    store.set(ACTIVITY_COOKIE, signActivityCookie("other-user", Date.now(), SECRET));
    cookieSet.mockClear();
    const mismatch = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(mismatch.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();

    store.set(ACTIVITY_COOKIE, `${signActivityCookie(USER, Date.now(), SECRET)}tampered`);
    const forged = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(forged.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();

    store.set(ACTIVITY_COOKIE, signActivityCookie(USER, Date.now() - IDLE_TIMEOUT, SECRET));
    const expired = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(expired.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("没有登录时间或用户 id 无法签名时不写 Cookie", async () => {
    getUser.mockResolvedValue({ data: { user: { id: USER } }, error: null });
    const missingStamp = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(missingStamp.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();

    signedIn(new Date().toISOString(), "bad.id");
    const dotted = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(dotted.status).toBe(503);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("有效 Cookie 可以刷新时间戳", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    store.set(ACTIVITY_COOKIE, signActivityCookie(USER, Date.now() - 60_000, SECRET));
    const response = await POST(activityRequest("https://www.bingetrack.ing"));
    expect(response.status).toBe(204);
    expect(verifyActivityCookie(store.get(ACTIVITY_COOKIE), USER, Date.now(), SECRET)).toEqual({
      ok: true,
      at: Date.now(),
    });
  });
});
