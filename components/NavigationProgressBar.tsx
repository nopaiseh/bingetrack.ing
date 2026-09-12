"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** 监听站内链接点击与路由变化，在视口顶端提供即时的微光进度反馈。 */
export default function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastPathRef = useRef(`${pathname}?${searchParams.toString()}`);

  // 路由发生实际变化时推进到 100% 并淡出
  useEffect(() => {
    const currentPath = `${pathname}?${searchParams.toString()}`;
    if (currentPath === lastPathRef.current) return;
    lastPathRef.current = currentPath;

    const finishTimer = setTimeout(() => {
      setProgress(100);
    }, 0);

    const resetTimer = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);

    return () => {
      clearTimeout(finishTimer);
      clearTimeout(resetTimer);
    };
  }, [pathname, searchParams]);

  // 监听所有站内 a 标签点击，提供 0ms 即刻响应
  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      // 忽略右键、中键、新窗口打开等行为
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }

      const target = (event.target as HTMLElement)?.closest("a");
      if (!target || !target.href) return;

      const targetUrl = new URL(target.href, window.location.href);
      const currentUrl = new URL(window.location.href);

      // 仅处理同源、非纯锚点变化且目标地址不同的点击
      if (targetUrl.origin !== currentUrl.origin) return;
      if (target.hasAttribute("download") || target.target === "_blank") return;
      if (targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search) {
        return;
      }

      startTransition(() => {
        setVisible(true);
        setProgress(30);
      });
    };

    document.addEventListener("click", handleAnchorClick, { capture: true });
    return () => document.removeEventListener("click", handleAnchorClick, { capture: true });
  }, []);

  // 处于加载中时模拟进度逐渐向前推进
  useEffect(() => {
    if (!visible || progress >= 90) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) return prev;
        const increment = Math.max(1, Math.floor((90 - prev) / 6));
        return prev + increment;
      });
    }, 180);

    return () => clearInterval(interval);
  }, [visible, progress]);

  if (!visible && progress === 0) return null;

  return (
    <div
      role="progressbar"
      aria-label="页面流转加载进度"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      className="fixed left-0 top-0 z-[120] h-[2.5px] w-full pointer-events-none transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="h-full bg-linear-to-r from-red-600 via-red-500 to-rose-400 shadow-[0_0_12px_rgba(239,68,68,0.9),0_0_5px_rgba(248,113,113,0.8)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
