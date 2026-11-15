"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resetIdleSession } from "./idle";
import { hasSupabaseAuthCookie } from "./session-cookie";

/**
 * 按需加载浏览器认证客户端。
 * 静态导入会把 @supabase/ssr 和整份 supabase-js 打进每个公开页面的首屏脚本。
 */
function loadAuthBrowser() {
  return import("./browser").then((mod) => mod.getAuthBrowser());
}

type AuthBrowser = Awaited<ReturnType<typeof loadAuthBrowser>>;
type AppRouter = ReturnType<typeof useRouter>;

/** 订阅会话并校验站长身份。空闲登出由根布局的 IdleSession 负责，管理区不挂导航栏时也会运行。 */
function attachNavbarSession(
  db: AuthBrowser,
  router: AppRouter,
  authenticating: { current: boolean },
  setSignedIn: (signedIn: boolean) => void,
  setOwner: (owner: boolean) => void,
) {
  let disposed = false;
  let revision = 0;
  const {
    data: { subscription },
  } = db.auth.onAuthStateChange((_event, session) => {
    const version = ++revision;
    const id = session?.user.id;
    if (id && authenticating.current) resetIdleSession(id);
    setSignedIn(Boolean(id));
    setOwner(false);
    if (id) {
      // 离开 Auth 回调后才调用 RPC，避免会话锁重入。
      window.setTimeout(() => {
        if (disposed || version !== revision) return;
        void db.rpc("is_site_owner").then(({ data, error }) => {
          if (!disposed && version === revision) setOwner(!error && data === true);
        });
      }, 0);
    } else if (_event === "SIGNED_OUT") {
      router.replace("/");
      router.refresh();
    }
  });
  return () => {
    disposed = true;
    subscription.unsubscribe();
  };
}

/** 在全站导航同步会话并校验管理入口。空闲计时不在这里。 */
export function useNavbarAuth() {
  const router = useRouter();
  const authenticating = useRef(false);
  const stopSession = useRef<(() => void) | undefined>(undefined);
  const ensureSession = useRef<(db: AuthBrowser) => void>(() => {});
  const [signedIn, setSignedIn] = useState(false);
  const [owner, setOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    // 登录点击和会话恢复共用这一份订阅；写在 effect 里以读到当前 router。
    ensureSession.current = (db) => {
      if (stopSession.current) return;
      const stop = attachNavbarSession(db, router, authenticating, setSignedIn, setOwner);
      stopSession.current = () => {
        stop();
        stopSession.current = undefined;
      };
    };
    const queryError = new URLSearchParams(window.location.search).get("authError");
    if (queryError)
      queueMicrotask(() => {
        if (!cancelled)
          setError(queryError === "access" ? "此账号没有管理权限。" : "登录链接无效或已过期，请重新获取。");
      });
    // 匿名访客没有可读的会话 Cookie（@supabase/ssr 默认 httpOnly: false），不下载 supabase-js。
    if (hasSupabaseAuthCookie(document.cookie)) {
      void loadAuthBrowser()
        .then((db) => {
          if (!cancelled) ensureSession.current(db);
        })
        .catch(() => {
          // 分块加载失败时保持未登录导航；再次点击登录会重试。
        });
    }
    return () => {
      cancelled = true;
      stopSession.current?.();
    };
  }, [router]);

  /** 按键直接调用 Passkey，验证成功后进入管理区。 */
  async function signIn() {
    authenticating.current = true;
    setBusy(true);
    setError("");
    // 本地开发环境免密直接登录，生产环境保持 Passkey 验证
    if (process.env.NODE_ENV === "development") {
      window.location.replace("/auth/dev-login");
      return;
    }

    try {
      const db = await loadAuthBrowser();
      ensureSession.current(db);
      const { data, error } = await db.auth.signInWithPasskey();
      if (error) {
        setError(
          error.code === "passkey_disabled"
            ? "Passkey 登录尚未启用，请先完成站点配置。"
            : "未完成 Passkey 验证，请重试或使用已绑定凭证的设备。",
        );
        return;
      }
      if (data.user) {
        resetIdleSession(data.user.id);
        // 先写下服务端活动 Cookie，再进入管理区，避免 proxy 把刚登录的会话当成缺失活动而登出。
        const activity = await fetch("/auth/activity", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!activity.ok) {
          setError("登录已完成，但空闲保护未能启动，请重试。");
          return;
        }
      }
      router.replace("/manage");
      router.refresh();
    } catch {
      setError("无法连接登录服务，请检查网络和浏览器是否支持 Passkey。");
    } finally {
      authenticating.current = false;
      setBusy(false);
    }
  }

  return { signedIn, owner, busy, error, signIn };
}
