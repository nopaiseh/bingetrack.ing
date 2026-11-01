"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * 使用独立 Cookie 会话登录管理区，不改变公开数据客户端。
 * 公开导航只能动态导入本模块，静态导入会把 supabase-js 带进匿名访客的首屏包。
 */
export function getAuthBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { experimental: { passkey: true } } },
  );
}
