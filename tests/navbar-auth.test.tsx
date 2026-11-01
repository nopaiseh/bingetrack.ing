import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import Navbar from "@/components/Navbar";

const getAuthBrowser = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/browser", () => ({ getAuthBrowser }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace, refresh, push }),
}));

const cookies = new Set<string>();

function setCookie(name: string, value = "session") {
  cookies.add(name);
  document.cookie = `${name}=${value}`;
}

function clearCookies() {
  for (const name of cookies) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
  cookies.clear();
}

beforeEach(() => {
  getAuthBrowser.mockReset();
  replace.mockReset();
  refresh.mockReset();
  push.mockReset();
  window.history.pushState({}, "", "/");
});

afterEach(() => {
  clearCookies();
});

test("公开导航源码不静态引入 supabase 浏览器客户端", () => {
  const hook = readFileSync(join(process.cwd(), "lib/auth/use-navbar-auth.ts"), "utf8");
  const navbar = readFileSync(join(process.cwd(), "components/Navbar.tsx"), "utf8");
  const imports = hook.split("\n").filter((line) => /^\s*import\s/.test(line)).join("\n");
  expect(imports).not.toMatch(/browser|@supabase\//);
  expect(navbar).not.toMatch(/@supabase\/|lib\/auth\/browser/);
  expect(hook).toMatch(/import\(\s*["']\.\/browser["']\s*\)/);
});

test("匿名访客不加载认证客户端，登录失败提示仍可用", async () => {
  const user = userEvent.setup();
  const signInWithPasskey = vi.fn(async () => ({ data: { user: null }, error: { code: "passkey_disabled" } }));
  getAuthBrowser.mockReturnValue({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPasskey,
    },
    rpc: vi.fn(),
  });

  render(<Navbar />);
  expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(getAuthBrowser).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "登录" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Passkey 登录尚未启用，请先完成站点配置。");
  expect(getAuthBrowser).toHaveBeenCalled();
  expect(signInWithPasskey).toHaveBeenCalledOnce();
});

test("仅有 PKCE verifier 时不加载认证客户端", async () => {
  setCookie("sb-example-auth-token-code-verifier");
  render(<Navbar />);
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(getAuthBrowser).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
});

test("authError 不依赖认证客户端", async () => {
  window.history.pushState({}, "", "/?authError=access");
  render(<Navbar />);
  expect(await screen.findByRole("alert")).toHaveTextContent("此账号没有管理权限。");
  expect(getAuthBrowser).not.toHaveBeenCalled();
});

test("已有会话 Cookie 时站长看到管理和退出", async () => {
  const unsubscribe = vi.fn();
  setCookie("sb-example-auth-token.0");
  getAuthBrowser.mockReturnValue({
    auth: {
      onAuthStateChange: (callback: (event: string, session: { user: { id: string; last_sign_in_at: string } } | null) => void) => {
        callback("INITIAL_SESSION", { user: { id: "owner-1", last_sign_in_at: new Date().toISOString() } });
        return { data: { subscription: { unsubscribe } } };
      },
      signOut: vi.fn(),
    },
    rpc: vi.fn(async () => ({ data: true, error: null })),
  });

  const { unmount } = render(<Navbar />);
  await waitFor(() => expect(screen.getByRole("button", { name: "退出" })).toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "登录" })).not.toBeInTheDocument();
  const manageLinks = screen.getAllByRole("link", { name: "管理" });
  expect(manageLinks).toHaveLength(2);
  for (const link of manageLinks) expect(link).toHaveAttribute("href", "/manage");
  expect(getAuthBrowser).toHaveBeenCalled();

  unmount();
  expect(unsubscribe).toHaveBeenCalled();
});
