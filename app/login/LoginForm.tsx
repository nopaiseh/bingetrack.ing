"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuthBrowser } from "@/lib/auth/browser";

/** 唤起设备凭证并在登录成功后交由服务端检查站长权限。 */
export default function LoginForm({ initialError }: { initialError: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  /** 验证成功后刷新服务端会话视图并进入管理区。 */
  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const { error } = await getAuthBrowser().auth.signInWithPasskey();
      if (error) {
        setError(error.code === "passkey_disabled" ? "Passkey 登录尚未启用，请先完成站点配置。" : "未完成 Passkey 验证，请重试或使用已绑定凭证的设备。");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("无法连接登录服务，请检查网络和浏览器是否支持 Passkey。");
    } finally {
      setBusy(false);
    }
  }
  return <div className="space-y-5">
    <button type="button" onClick={signIn} disabled={busy} className="w-full rounded-xl bg-red-700 px-5 py-3 font-medium text-white hover:bg-red-600 disabled:opacity-60">{busy ? "等待设备验证…" : "使用 Passkey 登录"}</button>
    <p role="alert" className="text-sm text-red-300">{error}</p>
    <p className="text-sm leading-relaxed text-neutral-400">首次使用时，请通过初始化链接绑定凭证。凭证丢失后，可通过站长恢复流程重新绑定。</p>
    <Link href="/" className="inline-block text-sm text-neutral-300 underline underline-offset-4">返回公开网站</Link>
  </div>;
}
