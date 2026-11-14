import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const { verifyOtp, cookieSet } = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  cookieSet: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: cookieSet,
    delete: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/server", () => ({
  getAuthServer: async () => ({
    auth: {
      verifyOtp: async (input: unknown) => {
        const result = await verifyOtp(input);
        if (!result?.error) cookieSet("sb-test-auth-token", "session");
        return result;
      },
    },
  }),
}));

import ConfirmPage, { metadata } from "@/app/auth/confirm/page";

async function renderConfirm(query: Record<string, string | string[]>) {
  const view = await ConfirmPage({ searchParams: Promise.resolve(query) });
  return render(view);
}

describe("确认页", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    cookieSet.mockReset();
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("GET 不调用 verifyOtp，也不写登录 Cookie", async () => {
    await renderConfirm({ type: "magiclink", token_hash: "test", next: "/manage" });
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
    const button = screen.getByRole("button", { name: "Continue / 继续登录" });
    const form = button.closest("form");
    expect(button).toHaveAttribute("type", "submit");
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/auth/confirm");
    expect(form?.querySelector("input[name='token_hash']")).toHaveValue("test");
    expect(form?.querySelector("input[name='type']")).toHaveValue("magiclink");
    expect(form?.querySelector("input[name='next']")).toHaveValue("/manage");
  });

  it("invite 同样只渲染确认按钮", async () => {
    await renderConfirm({ type: "invite", token_hash: "invite-token" });
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Continue / 继续登录" })).toBeInTheDocument();
    expect(document.querySelector("input[name='next']")).toHaveValue("/settings");
  });

  it("无效类型和外部回跳不渲染表单，也不验证", async () => {
    await expect(renderConfirm({ type: "signup", token_hash: "test", next: "https://example.com" }))
      .rejects.toThrow("REDIRECT:/?authError=link");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
    expect(document.body).not.toHaveTextContent("example.com");
  });

  it("外部 next 不会写进表单", async () => {
    await renderConfirm({ type: "magiclink", token_hash: "test", next: "https://example.com" });
    expect(document.querySelector("input[name='next']")).toHaveValue("/settings");
    expect(document.body.innerHTML).not.toContain("example.com");
  });

  it("确认页 noindex", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("加载后从地址栏移除 token_hash 和 type，表单仍保留原值", async () => {
    window.history.replaceState(null, "", "/auth/confirm?token_hash=test&type=magiclink&next=%2Fmanage");
    await renderConfirm({ type: "magiclink", token_hash: "test", next: "/manage" });
    await waitFor(() => {
      expect(window.location.search).not.toContain("token_hash");
      expect(window.location.search).not.toContain("type=");
    });
    expect(window.location.pathname).toBe("/auth/confirm");
    expect(window.location.search).toBe("?next=%2Fmanage");
    expect(document.querySelector("input[name='token_hash']")).toHaveValue("test");
    expect(document.querySelector("input[name='type']")).toHaveValue("magiclink");
    expect(verifyOtp).not.toHaveBeenCalled();
    window.history.replaceState(null, "", "/");
  });
});