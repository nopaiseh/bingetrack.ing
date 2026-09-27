"use client";

import { useState } from "react";
import { getAuthBrowser } from "@/lib/auth/browser";

type Key = { id: string; friendly_name?: string; created_at: string; last_used_at?: string };

/** 管理本人凭证；删除前重新验证并保留最后一个凭证，降低误锁账号风险。 */
export default function PasskeySettings({ initialKeys, initialError }: { initialKeys: Key[]; initialError: string }) {
  const [keys, setKeys] = useState(initialKeys);
  const [message, setMessage] = useState(initialError);
  const [busy, setBusy] = useState(false);
  /** 执行凭证变更并刷新列表，任何失败都保留当前页面。 */
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await operation();
      const { data, error } = await getAuthBrowser().auth.passkey.list();
      if (error) throw error;
      setKeys(data ?? []);
      setMessage("凭证已更新。");
    } catch { setMessage("操作未完成，请重试；如取消了设备验证，凭证不会被更改。"); }
    finally { setBusy(false); }
  }
  /** 唤起操作系统创建新凭证。 */
  async function add() {
    await run(async function register() {
      const { error } = await getAuthBrowser().auth.registerPasskey();
      if (error) throw error;
    });
  }
  /** 重新验证当前账号后删除指定凭证。 */
  async function remove(key: Key) {
    if (keys.length < 2 || !window.confirm(`移除「${key.friendly_name || "Passkey"}」？请确认另一个凭证可以使用。`)) return;
    await run(async function revoke() {
      const db = getAuthBrowser();
      const before = await db.auth.getUser();
      if (before.error || !before.data.user) throw new Error("未登录");
      const verified = await db.auth.signInWithPasskey();
      if (verified.error || verified.data.user?.id !== before.data.user.id) throw new Error("身份不匹配");
      const { error } = await db.auth.passkey.delete({ passkeyId: key.id });
      if (error) throw error;
    });
  }
  /** 用表单提供的名称更新凭证标签。 */
  async function rename(form: FormData) {
    const friendlyName = String(form.get("name") ?? "").trim();
    if (!friendlyName || friendlyName.length > 120) { setMessage("凭证名称应为 1–120 个字符。"); return; }
    await run(async function update() {
      const { error } = await getAuthBrowser().auth.passkey.update({ passkeyId: String(form.get("id")), friendlyName });
      if (error) throw error;
    });
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h2 className="admin-section-title text-xl font-semibold text-white">已绑定凭证 <span className="text-sm font-normal text-neutral-400">{keys.length}</span></h2>
    <button type="button" onClick={add} disabled={busy} className="admin-primary">{busy ? "处理中…" : "添加 Passkey"}</button>
    </div>
    {message && <p role="status" className="surface-muted rounded-xl border border-white/10 px-4 py-3 text-sm text-red-200">{message}</p>}
    {!keys.length && <p className="surface-panel rounded-2xl px-6 py-16 text-center text-sm text-neutral-300">尚未绑定凭证。添加后即可使用 Passkey 登录。</p>}
    <ul className="grid gap-5 lg:grid-cols-2">{keys.map(/* 每个凭证提供独立名称表单和移除操作。 */ key => <li key={key.id} className="surface-card rounded-2xl p-5 sm:p-6">
      <form action={rename} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={key.id} />
        <label className="min-w-0 basis-full">凭证名称<input name="name" defaultValue={key.friendly_name || "Passkey"} maxLength={120} required /></label>
        <button disabled={busy} type="submit">重命名</button>
        <button className="admin-danger" type="button" disabled={busy || keys.length < 2} onClick={/* 传入当前凭证并请求重新验证。 */ () => remove(key)}>移除</button>
      </form>
      <p className="mt-3 text-xs text-neutral-400">创建于 {key.created_at.slice(0, 10)}{keys.length < 2 ? " · 请先添加备用凭证，再移除这个凭证。" : ""}</p>
    </li>)}</ul>
  </div>;
}
