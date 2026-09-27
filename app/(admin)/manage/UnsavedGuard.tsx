"use client";
import { useEffect, useRef } from "react";

const LEAVE_MESSAGE = "还有未保存的修改，确定离开吗？";
const GUARD_KEY = "__manageGuard";
const PATCHED = Symbol.for("manage.guardHistory");

let activeGuards = 0;
let lastState: unknown = null;
let lastHref = "";
let listening = false;

function isGuardState(state: unknown) {
  return typeof state === "object" && state !== null && GUARD_KEY in state;
}
function remember() {
  lastState = window.history.state;
  lastHref = window.location.href;
}

/** 守卫记录只是下方记录的同地址副本：在它上面导航改为替换，离开后就不会多出一次无效后退。
 * 守卫失效后仍留在栈顶的副本（如快速编辑弹窗关闭），后退经过时自动再退一步跳过。 */
function installHistoryPatch() {
  const history = window.history;
  if (!(history.pushState as { [PATCHED]?: true })[PATCHED]) {
    const push = history.pushState;
    const replace = history.replaceState;
    const patchedPush = function (data: unknown, unused: string, url?: string | URL | null) {
      (isGuardState(history.state) ? replace : push).call(history, data, unused, url);
      remember();
    };
    const patchedReplace = function (data: unknown, unused: string, url?: string | URL | null) {
      // Next.js 刷新当前页时会替换状态，守卫标记要跟着保留。
      const sameEntry = url == null || new URL(url, window.location.href).href === window.location.href;
      if (isGuardState(history.state) && sameEntry) data = { ...(data as object | null), [GUARD_KEY]: true };
      replace.call(history, data, unused, url);
      remember();
    };
    history.pushState = Object.assign(patchedPush, { [PATCHED]: true as const });
    history.replaceState = patchedReplace;
  }
  if (!listening) {
    listening = true;
    window.addEventListener("popstate", () => {
      const leftGuard = isGuardState(lastState) && lastHref === window.location.href;
      remember();
      if (leftGuard && activeGuards === 0) window.history.back();
    });
  }
  remember();
}

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
    /** 后退先回到下方的同地址记录；取消时重新压入以保持拦截，确认时再后退一步真正离开。
     * 已确认过就同时撤下 beforeunload，否则后退到站外或整页加载的记录时浏览器会再问一次。 */
    function beforeHistoryBack() {
      guardEntry.current = false;
      if (window.confirm(LEAVE_MESSAGE)) {
        window.removeEventListener("popstate", beforeHistoryBack);
        window.removeEventListener("beforeunload", beforeUnload);
        window.history.back();
      } else {
        window.history.pushState({ [GUARD_KEY]: true }, "", window.location.href);
        guardEntry.current = true;
      }
    }
    installHistoryPatch();
    activeGuards += 1;
    // 压入与当前地址相同的历史记录，浏览器后退时停留在本页并触发 popstate；Next.js 会同步原生 History 调用。
    if (!guardEntry.current || !isGuardState(window.history.state)) {
      window.history.pushState({ [GUARD_KEY]: true }, "", window.location.href);
      guardEntry.current = true;
    }
    document.addEventListener("manage:before-leave", beforeLeave);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", beforeHistoryBack);
    document.addEventListener("click", beforeLink, true);
    return () => {
      activeGuards -= 1;
      document.removeEventListener("manage:before-leave", beforeLeave);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", beforeHistoryBack);
      document.removeEventListener("click", beforeLink, true);
    };
  }, [dirty]);
  return null;
}
