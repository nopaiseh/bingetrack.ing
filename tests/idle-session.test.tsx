import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import HideOnAdmin from "@/components/HideOnAdmin";
import IdleSession from "@/components/IdleSession";
import { ACTIVITY_REPORT_INTERVAL, IDLE_TIMEOUT } from "@/lib/auth/idle";
import { SIGNED_IN_EVENT, isSameSitePath, logoutEverywhere, reportIdleActivity } from "@/lib/auth/use-idle-session";

const getAuthBrowser = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/browser", () => ({ getAuthBrowser }));
vi.mock("@/lib/auth/location", () => ({
  replaceDocument: (url: string) => replace(url),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/manage",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));

const fetchMock = vi.fn<(input?: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
  async () => new Response(null, { status: 204 }),
);
const cookies = new Set<string>();

function setCookie(name: string) {
  cookies.add(name);
  document.cookie = `${name}=session`;
}

function clearCookies() {
  for (const name of cookies) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  cookies.clear();
}

function signedInClient() {
  const signOut = vi.fn(async () => ({ error: null }));
  getAuthBrowser.mockReturnValue({
    auth: {
      onAuthStateChange: (
        callback: (event: string, session: { user: { id: string; last_sign_in_at: string } } | null) => void,
      ) => {
        callback("INITIAL_SESSION", { user: { id: "user-1", last_sign_in_at: new Date().toISOString() } });
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signOut,
    },
  });
  return { signOut };
}

beforeEach(() => {
  getAuthBrowser.mockReset();
  fetchMock.mockClear();
  replace.mockReset();
  localStorage.clear();
  replace.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  clearCookies();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("空闲计时挂在根布局，且不静态引入 supabase", () => {
  const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
  const idleAt = layout.indexOf("<IdleSession");
  const hideAt = layout.indexOf("<HideOnAdmin");
  expect(idleAt).toBeGreaterThan(-1);
  expect(hideAt).toBeGreaterThan(idleAt);
  expect(layout.slice(idleAt, hideAt)).not.toMatch(/HideOnAdmin/);

  const hook = readFileSync(join(process.cwd(), "lib/auth/use-idle-session.ts"), "utf8");
  const component = readFileSync(join(process.cwd(), "components/IdleSession.tsx"), "utf8");
  const imports = hook
    .split("\n")
    .filter((line) => /^\s*import\s/.test(line))
    .join("\n");
  expect(imports).not.toMatch(/browser|@supabase\//);
  expect(component).not.toMatch(/@supabase\/|lib\/auth\/browser/);
  expect(hook).toMatch(/import\(\s*["']\.\/browser["']\s*\)/);
});

test("匿名访客不加载认证客户端，也不上报活动", async () => {
  render(<IdleSession />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(getAuthBrowser).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("管理页卸掉导航后仍会在 30 分钟后登出", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  setCookie("sb-example-auth-token.0");
  signedInClient();
  render(
    <>
      <IdleSession />
      <HideOnAdmin>
        <p>公开导航</p>
      </HideOnAdmin>
    </>,
  );
  expect(screen.queryByText("公开导航")).not.toBeInTheDocument();

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(getAuthBrowser).toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();

  await act(async () => {
    vi.advanceTimersByTime(IDLE_TIMEOUT);
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "/auth/logout",
    expect.objectContaining({ method: "POST", credentials: "same-origin" }),
  );
  expect(replace).toHaveBeenCalledWith("/");
});

test("活动上报最多每分钟一次，并且只在已登录时发送", async () => {
  const start = Date.parse("2026-01-01T00:00:00Z");
  expect(await reportIdleActivity("user-1", 0, start)).toBe("ok");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    "/auth/activity",
    expect.objectContaining({ method: "POST", credentials: "same-origin" }),
  );
  expect(await reportIdleActivity("user-1", start, start + ACTIVITY_REPORT_INTERVAL - 1)).toBe("throttled");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(await reportIdleActivity("user-1", start, start + ACTIVITY_REPORT_INTERVAL)).toBe("ok");
  expect(fetchMock).toHaveBeenCalledTimes(2);

  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(start);
  setCookie("sb-example-auth-token.0");
  fetchMock.mockClear();
  signedInClient();
  render(<IdleSession />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  await act(async () => {
    window.dispatchEvent(new Event("pointerdown"));
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);

  await act(async () => {
    window.dispatchEvent(new Event("keydown"));
    window.dispatchEvent(new Event("focus"));
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);

  await act(async () => {
    vi.advanceTimersByTime(ACTIVITY_REPORT_INTERVAL);
    window.dispatchEvent(new Event("scroll"));
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock).toHaveBeenLastCalledWith("/auth/activity", expect.objectContaining({ method: "POST" }));
});

test("未登录时挂载，登录信号之后才开始计时和上报", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  render(<IdleSession />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(getAuthBrowser).not.toHaveBeenCalled();

  setCookie("sb-example-auth-token.0");
  getAuthBrowser.mockReturnValue({
    auth: {
      onAuthStateChange: (
        callback: (event: string, session: { user: { id: string; last_sign_in_at: string } }) => void,
      ) => {
        callback("SIGNED_IN", { user: { id: "user-1", last_sign_in_at: new Date().toISOString() } });
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  });
  await act(async () => {
    window.dispatchEvent(new Event(SIGNED_IN_EVENT));
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(getAuthBrowser).toHaveBeenCalled();
  fetchMock.mockClear();
  await act(async () => {
    window.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
  });
  expect(fetchMock).toHaveBeenCalledWith("/auth/activity", expect.objectContaining({ method: "POST" }));
});

test("活动上报返回 401 时立即登出", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  setCookie("sb-example-auth-token.0");
  signedInClient();
  fetchMock.mockImplementation(async (input) => {
    if (String(input).includes("/auth/activity")) return new Response("Unauthorized", { status: 401 });
    return new Response(null, { status: 204 });
  });
  render(<IdleSession />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    window.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "/auth/logout",
    expect.objectContaining({ method: "POST", credentials: "same-origin" }),
  );
  expect(replace).toHaveBeenCalledWith("/");
});

test("登出请求失败时仍清理本地会话并离开页面", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  setCookie("sb-example-auth-token.0");
  const { signOut } = signedInClient();
  fetchMock.mockRejectedValue(new Error("offline"));
  render(<IdleSession />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    vi.advanceTimersByTime(IDLE_TIMEOUT);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(replace).toHaveBeenCalledWith("/");
});

test("指定站内地址登出，请求失败时仍清本地会话", async () => {
  const signOut = vi.fn(async () => ({ error: null }));
  getAuthBrowser.mockReturnValue({ auth: { signOut } });
  fetchMock.mockRejectedValue(new Error("offline"));
  logoutEverywhere("/?authError=activity");
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(replace).toHaveBeenCalledWith("/?authError=activity");

  signOut.mockClear();
  replace.mockClear();
  logoutEverywhere("//evil.example");
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(replace).toHaveBeenCalledWith("/");

  const unsafeTargets = [
    "/\\evil.example",
    "\\\\evil.example",
    "/%5Cevil.example",
    "/%2F/evil.example",
    "/%2F%2Fevil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "https://evil.example",
    "javascript:alert(1)",
  ];
  for (const target of unsafeTargets) {
    expect(isSameSitePath(target)).toBe(false);
    replace.mockClear();
    logoutEverywhere(target);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(replace).toHaveBeenCalledWith("/");
  }

  const safeTargets = ["/", "/?authError=activity", "/manage/shows?page=2"];
  for (const target of safeTargets) {
    expect(isSameSitePath(target)).toBe(true);
    replace.mockClear();
    logoutEverywhere(target);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(replace).toHaveBeenCalledWith(target);
  }
});
