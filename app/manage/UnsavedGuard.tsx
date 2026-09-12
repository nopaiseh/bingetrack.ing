"use client";
import { useEffect } from "react";
/** 浏览器关闭、刷新和站内链接跳转都提醒尚未保存的修改。 */
export default function UnsavedGuard({ dirty }: { dirty: boolean }) {
  useEffect(() => {
    if (!dirty) return;
    function beforeUnload(event: BeforeUnloadEvent) { event.preventDefault(); }
    function beforeLink(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Node | null;
      const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : target?.parentElement?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (anchor.target === "_blank" || href.startsWith("#") || href.startsWith("javascript:")) return;
      if (!event.defaultPrevented && !window.confirm("还有未保存的修改，确定离开吗？")) { event.preventDefault(); event.stopPropagation(); }
    }
    function beforeLeave(event: Event) { if (!window.confirm("还有未保存的修改，确定离开吗？")) event.preventDefault(); }
    document.addEventListener("manage:before-leave", beforeLeave);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeLink, true);
    return () => { document.removeEventListener("manage:before-leave", beforeLeave); window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", beforeLink, true); };
  }, [dirty]);
  return null;
}
