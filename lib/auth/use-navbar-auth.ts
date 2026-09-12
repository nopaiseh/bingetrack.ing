"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthBrowser } from "./browser";
import { resetIdleSession, watchIdleSession } from "./idle";

/** 在全站导航同步会话、校验管理入口，并监听真实操作的空闲时间。 */
export function useNavbarAuth() {
  const router = useRouter();
  const authenticating = useRef(false);
  const [signedIn, setSignedIn] = useState(false);
  const [owner, setOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const db = getAuthBrowser();
    let disposed = false;
    let revision = 0;
    let currentUser: string | undefined;
    let stopIdle: (() => void) | undefined;
    const queryError = new URLSearchParams(window.location.search).get("authError");
    if (queryError) queueMicrotask(() => {
      if (!disposed) setError(queryError === "access" ? "此账号没有管理权限。" : "登录链接无效或已过期，请重新获取。");
    });
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      const version = ++revision;
      const id = session?.user.id;
      if (id && authenticating.current) resetIdleSession(id);
      setSignedIn(Boolean(id));
      setOwner(false);
      if (id !== currentUser) {
        stopIdle?.();
        currentUser = id;
        if (id) stopIdle = watchIdleSession(id, () => {
          // 通过 POST 接口清理会话，再完整导航回首页以清除管理页内存与路由缓存。
          void fetch("/auth/logout", { method: "POST" }).finally(() => {
            window.location.replace("/");
          });
        });
      }
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
    return () => { disposed = true; subscription.unsubscribe(); stopIdle?.(); };
  }, [router]);

  /** 按键直接调用 Passkey，验证成功后进入管理区。 */
  async function signIn() {
    authenticating.current = true;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await getAuthBrowser().auth.signInWithPasskey();
      if (error) {
        setError(error.code === "passkey_disabled" ? "Passkey 登录尚未启用，请先完成站点配置。" : "未完成 Passkey 验证，请重试或使用已绑定凭证的设备。");
        return;
      }
      if (data.user) resetIdleSession(data.user.id);
      router.replace("/manage");
      router.refresh();
    } catch { setError("无法连接登录服务，请检查网络和浏览器是否支持 Passkey。"); }
    finally { authenticating.current = false; setBusy(false); }
  }

  return { signedIn, owner, busy, error, signIn };
}
