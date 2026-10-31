"use client";

import { useState } from "react";
import { getAuthBrowser } from "@/lib/auth/browser";
import StatusModal from "../manage/StatusModal";
import { createAgentLoginLink } from "./actions";

type Key = { id: string; friendly_name?: string; created_at: string; last_used_at?: string };

/** 管理本人凭证；删除前重新验证并保留最后一个凭证，降低误锁账号风险。 */
export default function PasskeySettings({ initialKeys, initialError }: { initialKeys: Key[]; initialError: string }) {
  const [keys, setKeys] = useState(initialKeys);
  const [message, setMessage] = useState<{ id: number; text: string; tone: "success" | "error" }>({ id: 0, text: initialError, tone: "error" });
  const [busy, setBusy] = useState(false);
  const [agentLink, setAgentLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  /** 递增 id 让相同文案的连续结果也会重新弹出通知。 */
  const notify = (text: string, tone: "success" | "error") => setMessage(previous => ({ id: previous.id + 1, text, tone }));
  /** 生成用完即焚的 Agent 一次性登录链接并尝试自动复制到剪贴板。 */
  async function generateAgentLink() {
    setGeneratingLink(true);
    notify("", "error");
    try {
      const result = await createAgentLoginLink();
      if (result.error || !result.url) {
        notify(result.error || "生成一次性登录链接失败。", "error");
        return;
      }
      setAgentLink(result.url);
      const copied = await navigator.clipboard?.writeText(result.url).then(() => true).catch(() => false);
      notify(copied ? "已生成并复制一次性登录链接（仅限点击 1 次）。" : "一次性登录链接已生成，请手动复制。", "success");
    } catch {
      notify("生成一次性登录链接失败，请重试。", "error");
    } finally {
      setGeneratingLink(false);
    }
  }
  /** 复制当前已生成的 Agent 一次性登录链接。 */
  async function copyAgentLink() {
    if (!agentLink) return;
    const copied = await navigator.clipboard?.writeText(agentLink).then(() => true).catch(() => false);
    notify(copied ? "一次性登录链接已复制到剪贴板。" : "无法自动复制，请直接选中输入框内容复制。", copied ? "success" : "error");
  }
  /** 执行凭证变更并刷新列表，任何失败都保留当前页面。 */
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    notify("", "error");
    try {
      await operation();
      const { data, error } = await getAuthBrowser().auth.passkey.list();
      if (error) throw error;
      setKeys(data ?? []);
      notify("凭证已更新。", "success");
    } catch { notify("操作未完成，请重试；如取消了设备验证，凭证不会被更改。", "error"); }
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
    if (!friendlyName || friendlyName.length > 120) { notify("凭证名称应为 1–120 个字符。", "error"); return; }
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
    {message.text && <StatusModal key={message.id} tone={message.tone} message={message.text} />}
    {!keys.length && <p className="surface-panel rounded-2xl px-6 py-16 text-center text-sm text-neutral-300">尚未绑定凭证。添加后即可使用 Passkey 登录。</p>}
    <ul className="grid gap-5 lg:grid-cols-2">{keys.map(/* 每个凭证提供独立名称表单和移除操作。 */ key => <li key={key.id} className="surface-card space-y-4 rounded-2xl border border-white/10 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-light)]"><span className="i-material-symbols-key-rounded size-5" aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="truncate font-medium text-white">{key.friendly_name || "Passkey"}</p>
          <p className="font-mono text-xs text-neutral-400">创建于 {key.created_at.slice(0, 10)}{key.last_used_at ? ` · 最后使用 ${key.last_used_at.slice(0, 10)}` : " · 尚未使用"}</p>
        </div>
      </div>
      <form action={rename} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={key.id} />
        <label className="min-w-0 basis-full">凭证名称<input name="name" defaultValue={key.friendly_name || "Passkey"} maxLength={120} required /></label>
        <button disabled={busy} type="submit">重命名</button>
        <button className="admin-danger" type="button" disabled={busy || keys.length < 2} onClick={/* 传入当前凭证并请求重新验证。 */ () => remove(key)}>移除</button>
      </form>
      {keys.length < 2 && <p className="text-xs text-neutral-400">请先添加备用凭证，再移除这个凭证。</p>}
    </li>)}</ul>
    <section className="surface-card space-y-4 rounded-2xl border border-white/10 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="admin-section-title text-xl font-semibold text-white">Agent 临时登录链接</h2>
          <p className="text-sm text-neutral-400">供 Muse / Grok Bot 等无法调用本地硬件 Passkey 的云端浏览器 Agent 登录。每次生成的链接仅限点击 1 次（1 小时内有效），打开后直接进入管理台，闲置 30 分钟自动登出。</p>
        </div>
        <button type="button" onClick={generateAgentLink} disabled={generatingLink || busy} className="admin-primary shrink-0">
          {generatingLink ? "生成中…" : "生成一次性登录链接"}
        </button>
      </div>
      {agentLink && <div className="flex flex-wrap items-end gap-3 pt-2">
        <label className="min-w-0 flex-1">一次性登录链接（用完即失效）
          <input type="text" readOnly value={agentLink} onFocus={event => event.currentTarget.select()} className="font-mono text-xs" />
        </label>
        <button type="button" onClick={copyAgentLink}>复制链接</button>
      </div>}
    </section>
  </div>;
}
