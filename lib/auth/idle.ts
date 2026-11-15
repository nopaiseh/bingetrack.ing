export const IDLE_TIMEOUT = 30 * 60 * 1000;

/** 客户端向 /auth/activity 上报的最短间隔。 */
export const ACTIVITY_REPORT_INTERVAL = 60 * 1000;

const ACTIVITY_PREFIX = "bingetrack:activity:v1:";
const LOGOUT_PREFIX = "bingetrack:logout:v1:";
const CHANNEL = "bingetrack:idle:v1";

type IdleMessage = { type: "activity"; userId: string; at: number } | { type: "logout"; userId: string; at: number };

function activityKey(userId: string) {
  return `${ACTIVITY_PREFIX}${userId}`;
}

function logoutKey(userId: string) {
  return `${LOGOUT_PREFIX}${userId}`;
}

function postIdleMessage(message: IdleMessage) {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {
    /* 不支持 BroadcastChannel 时仍依赖 localStorage。 */
  }
}

/** 通知其他标签页立即登出。本页的 storage 事件不会回发给自己。 */
export function signalIdleLogout(userId: string) {
  const at = Date.now();
  try {
    localStorage.setItem(logoutKey(userId), String(at));
  } catch {
    /* 隐私模式下仍会通过 BroadcastChannel 通知同浏览器的其他页。 */
  }
  postIdleMessage({ type: "logout", userId, at });
}

/**
 * 跨标签页保存操作时间；存储不可用时仍保留当前页面的计时保护。
 * signedInAt 是本次会话的登录时间：存储里残留的上个会话时间早于它时以它为准，
 * 否则开发登录、邮件链接等不经过 resetIdleSession 的新会话会在加载时立即被判定过期。
 * 只有指针、键盘、滚动、触摸和回到前台算作活动；焦点和令牌刷新不算。
 */
export function watchIdleSession(userId: string, onExpire: () => void, signedInAt?: number, onActivity?: () => void) {
  const key = activityKey(userId);
  const floor = Number.isFinite(signedInAt) ? signedInAt! : 0;
  let last = Date.now();
  let expired = false;
  const read = () => {
    try {
      const value = Number(localStorage.getItem(key));
      if (Number.isFinite(value) && value > 0) last = Math.max(value, floor);
    } catch {
      /* 隐私模式下使用内存时间。 */
    }
  };
  const write = () => {
    try {
      localStorage.setItem(key, String(last));
    } catch {
      /* 存储不可用不影响本页计时。 */
    }
  };
  const expire = () => {
    if (expired) return;
    expired = true;
    onExpire();
  };
  read();
  write();
  /** 先检查过期，避免恢复页面后的首次操作延长已过期会话。 */
  const check = () => {
    read();
    if (!expired && Date.now() - last >= IDLE_TIMEOUT) expire();
  };
  const mark = () => {
    check();
    if (expired || document.visibilityState === "hidden") return;
    last = Date.now();
    write();
    postIdleMessage({ type: "activity", userId, at: last });
    onActivity?.();
  };
  const onStorage = (event: Event) => {
    if (event instanceof StorageEvent && event.key === logoutKey(userId)) {
      if (event.newValue) expire();
      return;
    }
    check();
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") mark();
    else check();
  };
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event: MessageEvent<IdleMessage>) => {
      const message = event.data;
      if (!message || message.userId !== userId) return;
      if (message.type === "logout") {
        expire();
        return;
      }
      if (message.type === "activity" && typeof message.at === "number" && message.at > last) {
        last = message.at;
        write();
        check();
      }
    };
  } catch {
    channel = undefined;
  }
  const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"] as const;
  events.forEach((event) => window.addEventListener(event, mark, { passive: true }));
  window.addEventListener("focus", check);
  window.addEventListener("storage", onStorage);
  document.addEventListener("visibilitychange", onVisibility);
  const timer = window.setInterval(check, 1000);
  check();
  return () => {
    window.clearInterval(timer);
    events.forEach((event) => window.removeEventListener(event, mark));
    window.removeEventListener("focus", check);
    window.removeEventListener("storage", onStorage);
    document.removeEventListener("visibilitychange", onVisibility);
    channel?.close();
  };
}

/** 新验证完成后开始新的空闲周期，并清掉上一轮登出信号。 */
export function resetIdleSession(userId: string) {
  try {
    localStorage.setItem(activityKey(userId), String(Date.now()));
    localStorage.removeItem(logoutKey(userId));
  } catch {
    /* 使用页面内计时。 */
  }
}
