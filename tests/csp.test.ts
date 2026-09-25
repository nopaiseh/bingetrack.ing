import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, supabaseConnectOrigin } from "@/lib/csp";

describe("supabaseConnectOrigin", () => {
  it("只放行本项目的 HTTPS Supabase 源", () => {
    expect(supabaseConnectOrigin("https://abc.supabase.co", false)).toBe("https://abc.supabase.co");
  });

  it("本地 HTTP 回环地址仅在开发模式放行", () => {
    expect(supabaseConnectOrigin("http://127.0.0.1:54321", true)).toBe("http://127.0.0.1:54321");
    expect(supabaseConnectOrigin("http://127.0.0.1:54321", false)).toBe("https://*.supabase.co");
    expect(supabaseConnectOrigin("http://example.com", true)).toBe("https://*.supabase.co");
  });

  it("未配置或无效时回退到托管域名通配", () => {
    expect(supabaseConnectOrigin(undefined, false)).toBe("https://*.supabase.co");
    expect(supabaseConnectOrigin("not a url", false)).toBe("https://*.supabase.co");
  });
});

describe("buildContentSecurityPolicy", () => {
  it("connect-src 只包含自身、Supabase 与 Sentry 源", () => {
    const csp = buildContentSecurityPolicy({ isDevelopment: false, supabaseUrl: "https://abc.supabase.co", sentryOrigin: "https://o1.ingest.sentry.io" });
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co https://o1.ingest.sentry.io;");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("开发模式允许 unsafe-eval", () => {
    expect(buildContentSecurityPolicy({ isDevelopment: true })).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });
});
