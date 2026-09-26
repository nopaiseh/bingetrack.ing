export const IDLE_TIMEOUT = 30 * 60 * 1000;

/**
 * 跨标签页保存操作时间；存储不可用时仍保留当前页面的计时保护。
 * signedInAt 是本次会话的登录时间：存储里残留的上个会话时间早于它时以它为准，
 * 否则开发登录、邮件链接等不经过 resetIdleSession 的新会话会在加载时立即被判定过期。
 */
export function watchIdleSession(userId: string, onExpire: () => void, signedInAt?: number) {
  const key = `bingetrack:activity:v1:${userId}`;
  const floor = Number.isFinite(signedInAt) ? signedInAt! : 0;
  let last = Date.now();
  let expired = false;
  const read = () => {
    try {
      const value = Number(localStorage.getItem(key));
      if (Number.isFinite(value) && value > 0) last = Math.max(value, floor);
    } catch { /* 隐私模式下使用内存时间。 */ }
  };
  const write = () => {
    try { localStorage.setItem(key, String(last)); } catch { /* 存储不可用不影响本页计时。 */ }
  };
  read();
  write();
  /** 先检查过期，避免恢复页面后的首次操作延长已过期会话。 */
  const check = () => {
    read();
    if (!expired && Date.now() - last >= IDLE_TIMEOUT) {
      expired = true;
      onExpire();
    }
  };
  const activity = () => {
    check();
    if (!expired && document.visibilityState !== "hidden") {
      last = Date.now();
      write();
    }
  };
  const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"];
  events.forEach(event => window.addEventListener(event, activity, { passive: true }));
  window.addEventListener("focus", check);
  window.addEventListener("storage", check);
  document.addEventListener("visibilitychange", check);
  const timer = window.setInterval(check, 1000);
  check();
  return () => {
    window.clearInterval(timer);
    events.forEach(event => window.removeEventListener(event, activity));
    window.removeEventListener("focus", check);
    window.removeEventListener("storage", check);
    document.removeEventListener("visibilitychange", check);
  };
}

/** 新验证完成后开始新的空闲周期。 */
export function resetIdleSession(userId: string) {
  try { localStorage.setItem(`bingetrack:activity:v1:${userId}`, String(Date.now())); } catch { /* 使用页面内计时。 */ }
}
