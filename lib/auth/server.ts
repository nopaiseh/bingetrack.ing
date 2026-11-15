import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVITY_COOKIE, verifyActivityCookie } from "@/lib/auth/activity-cookie";
import { clearActivityCookie } from "@/lib/auth/activity-store";

/** 每次请求创建独立认证客户端，避免在用户之间共享会话。 */
export async function getAuthServer() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { experimental: { passkey: true } },
    cookies: {
      /** 读取当前请求的登录 Cookie。 */
      getAll: () => jar.getAll(),
      /** Server Component 不能写 Cookie；该场景由 Proxy 刷新。 */
      setAll(values) {
        try {
          for (const { name, value, options } of values) jar.set(name, value, options);
        } catch {
          // Server Component 的只读 Cookie 写入由 Proxy 接管。
        }
      },
    },
  });
}

/** 向 Auth 服务器验证账号，核对空闲 Cookie，再从数据库校验唯一站长身份；配置缺失时拒绝访问。 */
export async function requireOwner() {
  const db = await getAuthServer();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect("/");
  const jar = await cookies();
  const activity = verifyActivityCookie(jar.get(ACTIVITY_COOKIE)?.value, user.id);
  if (!activity.ok) {
    // 原因码只有活动 Cookie 的校验结果。不写用户 id、令牌或 Cookie 值。
    console.warn(`[requireOwner] ${activity.reason === "expired" ? "idle_expired" : activity.reason}`);
    try {
      await db.auth.signOut({ scope: "local" });
    } catch {
      // 写不了 Cookie 也要离开管理区，下一跳 proxy 仍会拒绝这份会话。
    }
    await clearActivityCookie();
    redirect("/");
  }
  const owner = await db.rpc("is_site_owner");
  if (owner.error || owner.data !== true) redirect("/?authError=access");
  return { db, user };
}
