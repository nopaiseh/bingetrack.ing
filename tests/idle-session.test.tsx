import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import HideOnAdmin from "@/components/HideOnAdmin";
import IdleSession from "@/components/IdleSession";
import { ACTIVITY_REPORT_INTERVAL, IDLE_TIMEOUT } from "@/lib/auth/idle";
import { reportIdleActivity } from "@/lib/auth/use-idle-session";

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

const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
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
  expect(reportIdleActivity("user-1", 0, start)).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    "/auth/activity",
    expect.objectContaining({ method: "POST", credentials: "same-origin" }),
  );
  expect(reportIdleActivity("user-1", start, start + ACTIVITY_REPORT_INTERVAL - 1)).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(reportIdleActivity("user-1", start, start + ACTIVITY_REPORT_INTERVAL)).toBe(true);
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
