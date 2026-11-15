"use client";

import { useEffect } from "react";
import { ACTIVITY_REPORT_INTERVAL, resetIdleSession, signalIdleLogout, watchIdleSession } from "@/lib/auth/idle";
import { replaceDocument } from "@/lib/auth/location";
import { hasSupabaseAuthCookie } from "@/lib/auth/session-cookie";

const REPORT_PREFIX = "bingetrack:activity-report:v1:";

/**
 * 按需加载浏览器认证客户端。
 * 静态导入会把 @supabase/ssr 和整份 supabase-js 打进每个公开页面的首屏脚本。
 */
function loadAuthBrowser() {
  return import("./browser").then((mod) => mod.getAuthBrowser());
}

function rememberReport(userId: string, now: number) {
  try {
    localStorage.setItem(`${REPORT_PREFIX}${userId}`, String(now));
  } catch {
    /* 内存中的上次上报时间仍能限制本页频率。 */
  }
}

function lastReportAt(userId: string, memory: number) {
  try {
    const stored = Number(localStorage.getItem(`${REPORT_PREFIX}${userId}`));
    if (Number.isFinite(stored)) return Math.max(memory, stored);
  } catch {
    /* 只用本页记录。 */
  }
  return memory;
}

/** 已登录时，真实操作最多每分钟上报一次。返回是否发出了请求。 */
export function reportIdleActivity(userId: string, memoryAt: number, now = Date.now()) {
  const last = lastReportAt(userId, memoryAt);
  if (last > 0 && now - last < ACTIVITY_REPORT_INTERVAL) return false;
  rememberReport(userId, now);
  void fetch("/auth/activity", { method: "POST", credentials: "same-origin", cache: "no-store" });
  return true;
}

/** 在根布局订阅会话。管理区不挂导航栏，所以空闲计时不能放在 Navbar 里。 */
export function useIdleSession() {
  useEffect(() => {
    if (!hasSupabaseAuthCookie(document.cookie)) return;
    let cancelled = false;
    let stopIdle: (() => void) | undefined;
    let unsubscribe = () => {};
    const memory = { userId: "", at: 0 };

    const report = (userId: string) => {
      const now = Date.now();
      const memoryAt = memory.userId === userId ? memory.at : 0;
      if (!reportIdleActivity(userId, memoryAt, now)) return;
      memory.userId = userId;
      memory.at = now;
    };

    const expire = (userId: string) => {
      signalIdleLogout(userId);
      void fetch("/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" })
        .catch(() => loadAuthBrowser().then((db) => db.auth.signOut({ scope: "local" })))
        .finally(() => {
          replaceDocument("/");
        });
    };

    void loadAuthBrowser()
      .then((db) => {
        if (cancelled) return;
        const {
          data: { subscription },
        } = db.auth.onAuthStateChange((event, session) => {
          const id = session?.user.id;
          if (event === "SIGNED_IN" && id) resetIdleSession(id);
          stopIdle?.();
          stopIdle = undefined;
          if (!id || !session) return;
          stopIdle = watchIdleSession(
            id,
            () => expire(id),
            Date.parse(session.user.last_sign_in_at ?? ""),
            () => report(id),
          );
        });
        unsubscribe = () => subscription.unsubscribe();
      })
      .catch(() => {
        // 分块加载失败时不阻断公开页面；下一次整页加载会再试。
      });

    return () => {
      cancelled = true;
      stopIdle?.();
      unsubscribe();
    };
  }, []);
}
