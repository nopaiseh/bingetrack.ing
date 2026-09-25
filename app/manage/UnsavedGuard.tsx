"use client";
import { useEffect, useRef } from "react";

const LEAVE_MESSAGE = "还有未保存的修改，确定离开吗？";

/** 浏览器关闭、刷新、站内链接跳转和浏览器后退都提醒尚未保存的修改。 */
export default function UnsavedGuard({ dirty }: { dirty: boolean }) {
  // 当前历史记录是否为本组件压入的同地址记录；保存期间守卫暂时关闭时保留它，重新启用时复用，避免堆积。
  const guardEntry = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    function beforeUnload(event: BeforeUnloadEvent) { event.preventDefault(); }
    function beforeLink(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Node | null;
      const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : target?.parentElement?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (anchor.target === "_blank" || !href || href.startsWith("#") || anchor.hasAttribute("download")) return;
      if (!event.defaultPrevented && !window.confirm(LEAVE_MESSAGE)) { event.preventDefault(); event.stopPropagation(); }
    }
    function beforeLeave(event: Event) { if (!window.confirm(LEAVE_MESSAGE)) event.preventDefault(); }
    /** 后退先回到下方的同地址记录；取消时重新压入以保持拦截，确认时再后退一步真正离开。 */
    function beforeHistoryBack() {
      guardEntry.current = false;
      if (window.confirm(LEAVE_MESSAGE)) {
        window.removeEventListener("popstate", beforeHistoryBack);
        window.history.back();
      } else {
        window.history.pushState(null, "", window.location.href);
        guardEntry.current = true;
      }
    }
    // 压入与当前地址相同的历史记录，浏览器后退时停留在本页并触发 popstate；Next.js 会同步原生 History 调用。
    if (!guardEntry.current) {
      window.history.pushState(null, "", window.location.href);
      guardEntry.current = true;
    }
    document.addEventListener("manage:before-leave", beforeLeave);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", beforeHistoryBack);
    document.addEventListener("click", beforeLink, true);
    return () => {
      document.removeEventListener("manage:before-leave", beforeLeave);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", beforeHistoryBack);
      document.removeEventListener("click", beforeLink, true);
    };
  }, [dirty]);
  return null;
}
