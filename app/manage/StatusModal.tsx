"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface StatusModalProps {
  /** 提示消息内容 */
  message: string;
  /** 弹窗标题，默认为“操作成功” */
  title?: string;
  /** 自动关闭倒计时（毫秒），默认 5000ms（5秒） */
  duration?: number;
  /** 弹窗关闭时的回调函数 */
  onClose?: () => void;
}

/**
 * /manage 模块专用的操作反馈弹窗。
 * - 移动端：吸底浮层抽屉（Bottom Sheet），适配单手大拇指触控并预留安全边距；
 * - 平板与桌面端：屏幕中央居中卡片（Centered Dialog），最大宽度适中，毛玻璃背景；
 * - 5 秒后平滑倒计时自动消失，支持悬停/长按暂停；
 * - 支持 Escape、点击遮罩或按钮即时关闭；
 * - 消息具有 role="status"，无障碍播报并兼容自动化测试。
 */
export default function StatusModal({
  message,
  title = "操作成功",
  duration = 5000,
  onClose,
}: StatusModalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [remainingTime, setRemainingTime] = useState(duration);
  const remainingTimeRef = useRef(duration);
  const isClosingRef = useRef(false);
  const isPausedRef = useRef(false);
  const lastTickRef = useRef<number>(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  /** 清除 URL 中的 saved / deleted 参数，避免刷新重复弹窗 */
  const cleanUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      let changed = false;
      if (url.searchParams.has("saved")) {
        url.searchParams.delete("saved");
        changed = true;
      }
      if (url.searchParams.has("deleted")) {
        url.searchParams.delete("deleted");
        changed = true;
      }
      if (changed) {
        const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") + url.hash;
        window.history.replaceState(window.history.state, "", next);
      }
    } catch {
      // 忽略在无 window 环境或解析异常
    }
  }, []);

  /** 执行平滑关闭动画后彻底卸载 */
  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);
    cleanUrl();
    setTimeout(() => {
      setIsOpen(false);
      onClose?.();
    }, 200);
  }, [cleanUrl, onClose]);

  // 初始自动聚焦到“知道了”按钮，方便键盘与辅助技术快速操作
  useEffect(() => {
    confirmBtnRef.current?.focus();
  }, []);

  // 倒计时与暂停管理
  useEffect(() => {
    lastTickRef.current = Date.now();
    const interval = setInterval(() => {
      if (isClosingRef.current) {
        clearInterval(interval);
        return;
      }
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      if (!isPausedRef.current) {
        remainingTimeRef.current -= delta;
        if (remainingTimeRef.current <= 0) {
          clearInterval(interval);
          setRemainingTime(0);
          handleClose();
        } else {
          setRemainingTime(remainingTimeRef.current);
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [handleClose]);

  // 监听 Escape 键快速关闭
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  // 组件卸载时清理参数
  useEffect(() => {
    return () => {
      cleanUrl();
    };
  }, [cleanUrl]);

  if (!isOpen) return null;

  const progressPercent = Math.max(0, Math.min(100, (remainingTime / duration) * 100));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-modal-title"
      aria-describedby="status-modal-desc"
      className={`fixed inset-0 z-50 flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:items-center sm:p-6 transition-opacity duration-200 ${
        isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* 半透明毛玻璃背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        onClick={handleClose}
      />

      {/* 弹窗内容卡片：手机端底部抽屉，平板与桌面端中心弹窗 */}
      <div
        ref={modalRef}
        onMouseEnter={() => { isPausedRef.current = true; }}
        onMouseLeave={() => {
          lastTickRef.current = Date.now();
          isPausedRef.current = false;
        }}
        onTouchStart={() => { isPausedRef.current = true; }}
        onTouchEnd={() => {
          lastTickRef.current = Date.now();
          isPausedRef.current = false;
        }}
        className={`relative w-full max-w-md overflow-hidden rounded-2xl sm:rounded-3xl border border-white/15 bg-neutral-900/95 p-5 sm:p-6 text-neutral-100 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl transition-all duration-200 ${
          isClosing
            ? "translate-y-4 sm:translate-y-0 sm:scale-95 opacity-0"
            : "translate-y-0 sm:scale-100 opacity-100"
        }`}
      >
        {/* 顶部关闭按钮 */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="关闭提示"
          className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white sm:right-4 sm:top-4"
        >
          <svg
            className="h-4.5 w-4.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-start gap-4">
          {/* 成功图标徽标 */}
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.25)] sm:h-12 sm:w-12"
            aria-hidden="true"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* 标题与内容 */}
          <div className="min-w-0 flex-1 pr-6 pt-0.5">
            <h2 id="status-modal-title" className="text-base font-semibold text-white sm:text-lg">
              {title}
            </h2>
            <div id="status-modal-desc" className="mt-1">
              <p
                role="status"
                aria-live="polite"
                className="text-sm leading-relaxed text-neutral-300 break-words"
              >
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* 操作区 */}
        <div className="mt-5 flex items-center justify-between gap-3 sm:mt-6">
          <span className="text-xs text-neutral-400 tabular-nums">
            {Math.ceil(remainingTime / 1000)} 秒后自动关闭
          </span>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={handleClose}
            className="admin-button admin-primary !min-h-9 !px-4 !py-1.5 text-xs font-medium sm:text-sm"
          >
            知道了
          </button>
        </div>

        {/* 底部 5 秒倒计时进度条 */}
        <div
          className="absolute inset-x-0 bottom-0 h-1 bg-white/10"
          role="progressbar"
          aria-valuenow={Math.round(progressPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="自动关闭倒计时"
        >
          <div
            className="h-full bg-linear-to-r from-emerald-500 to-emerald-400 transition-[width] duration-75 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
