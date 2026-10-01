"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

interface StatusModalProps {
  /** 提示消息内容 */
  message: string;
  /** 成功或失败，决定图标与颜色，默认成功 */
  tone?: "success" | "error";
  /** 自动关闭时间（毫秒），默认 5000ms */
  duration?: number;
  /** 提示消失后的回调函数 */
  onClose?: () => void;
}

const subscribe = () => () => {};

/** 打开原生模态 <dialog> 时，页面其余部分是 inert 的，通知要挂进最上层的模态弹窗里才能被看到和朗读。 */
function portalHost() {
  const modals = [...document.querySelectorAll("dialog[open]")].filter(dialog => dialog.matches(":modal"));
  return modals.at(-1) ?? document.body;
}

/**
 * /manage 模块专用的操作反馈提示：只显示图标与一句话，没有按钮和标题。
 * - 渲染到 body（有模态 <dialog> 时挂进弹窗内）并进入浏览器顶层，避免被导航栏或弹窗盖住；固定在导航栏下方水平居中；
 * - 容器不拦截指针事件，不阻碍后台表单操作；
 * - duration 后淡出并卸载，Escape 可提前关闭；
 * - role="status"（失败为 role="alert"），无障碍播报并兼容自动化测试。
 */
export default function StatusModal({ message, tone = "success", duration = 5000, onClose }: StatusModalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  const box = useRef<HTMLDivElement>(null);
  const host = useSyncExternalStore<Element | null>(subscribe, portalHost, () => null);

  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    let removeTimer: ReturnType<typeof setTimeout> | undefined;
    const close = () => {
      setIsClosing(true);
      removeTimer = setTimeout(() => { setIsOpen(false); onCloseRef.current?.(); }, 200);
    };
    const timer = setTimeout(close, duration);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      clearTimeout(timer);
      if (!removeTimer) close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { clearTimeout(timer); clearTimeout(removeTimer); window.removeEventListener("keydown", onKeyDown); };
  }, [duration]);

  // 放进浏览器顶层（popover），即使在原生 <dialog> 弹窗打开时也不会被盖住。
  useEffect(() => {
    const el = box.current;
    if (!el || !host || !isOpen) return;
    // 只在浏览器支持时才声明为 popover，不支持的环境退回普通固定定位。
    if (typeof el.showPopover !== "function") return;
    el.setAttribute("popover", "manual");
    el.showPopover();
  }, [host, isOpen]);

  if (!isOpen || !host) return null;

  const error = tone === "error";
  return createPortal(
    <div
      ref={box}
      className={`pointer-events-none fixed inset-x-0 top-20 z-[70] m-0 flex h-auto w-auto justify-center overflow-visible border-0 bg-transparent p-0 px-4 transition-all duration-200 ${isClosing ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"}`}
    >
      <div
        role={error ? "alert" : "status"}
        className={`flex max-w-md items-center gap-2.5 rounded-full border bg-neutral-900/95 py-2.5 pl-3 pr-5 text-sm text-neutral-100 shadow-[0_12px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl ${error ? "border-rose-500/40" : "border-emerald-500/40"}`}
      >
        <span
          className={`${error ? "i-material-symbols-error-rounded text-rose-400" : "i-material-symbols-check-circle-rounded text-emerald-400"} size-5 shrink-0`}
          aria-hidden="true"
        />
        <span className="break-words">{message}</span>
      </div>
    </div>,
    host,
  );
}

const noticeIds = new WeakMap<object, number>();
let nextNoticeId = 0;

/**
 * 把 useActionState 的结果显示成通知：有 error 显示失败，saved 且给了 saved 文案则显示成功。
 * 每个新的 state 对象都会弹出一条新通知，连续两次相同的结果也不会漏掉。
 */
export function ActionNotice({ state, saved }: { state: { error?: string; saved?: boolean }; saved?: string }) {
  const message = state.error || (state.saved ? saved : undefined);
  if (!message) return null;
  let id = noticeIds.get(state);
  if (id === undefined) { id = ++nextNoticeId; noticeIds.set(state, id); }
  return <StatusModal key={id} tone={state.error ? "error" : "success"} message={message} />;
}
