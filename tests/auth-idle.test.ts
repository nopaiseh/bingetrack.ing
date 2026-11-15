import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IDLE_TIMEOUT, resetIdleSession, signalIdleLogout, watchIdleSession } from "@/lib/auth/idle";
let stop: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
afterEach(() => {
  stop?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("30 分钟没有操作时只退出一次", () => {
  const expire = vi.fn();
  stop = watchIdleSession("owner", expire);
  vi.advanceTimersByTime(IDLE_TIMEOUT - 1000);
  expect(expire).not.toHaveBeenCalled();
  vi.advanceTimersByTime(2000);
  expect(expire).toHaveBeenCalledTimes(1);
});
it("操作延长计时，刷新页面不重置上次操作", () => {
  const expire = vi.fn();
  stop = watchIdleSession("owner", expire);
  vi.advanceTimersByTime(20 * 60 * 1000);
  window.dispatchEvent(new Event("keydown"));
  stop();
  stop = watchIdleSession("owner", expire);
  vi.advanceTimersByTime(20 * 60 * 1000);
  expect(expire).not.toHaveBeenCalled();
  vi.advanceTimersByTime(10 * 60 * 1000);
  expect(expire).toHaveBeenCalledTimes(1);
});
it("休眠后的首次操作不能复活过期会话", () => {
  const expire = vi.fn();
  stop = watchIdleSession("owner", expire);
  vi.setSystemTime(Date.now() + IDLE_TIMEOUT);
  window.dispatchEvent(new Event("pointerdown"));
  expect(expire).toHaveBeenCalledOnce();
});
it("其他标签页操作共享计时，新验证可开始新周期", () => {
  resetIdleSession("owner");
  vi.setSystemTime(Date.now() + IDLE_TIMEOUT);
  resetIdleSession("owner");
  const expire = vi.fn();
  stop = watchIdleSession("owner", expire);
  vi.advanceTimersByTime(IDLE_TIMEOUT - 1000);
  resetIdleSession("owner");
  window.dispatchEvent(new Event("storage"));
  vi.advanceTimersByTime(1000);
  expect(expire).not.toHaveBeenCalled();
});
it("新会话不继承上个会话残留的过期操作时间", () => {
  resetIdleSession("owner");
  vi.setSystemTime(Date.now() + 2 * IDLE_TIMEOUT);
  const expire = vi.fn();
  stop = watchIdleSession("owner", expire, Date.now());
  expect(expire).not.toHaveBeenCalled();
  vi.advanceTimersByTime(IDLE_TIMEOUT - 1000);
  expect(expire).not.toHaveBeenCalled();
  vi.advanceTimersByTime(2000);
  expect(expire).toHaveBeenCalledOnce();
});
it("登录后同样闲置 30 分钟的会话仍会过期", () => {
  const signedInAt = Date.now();
  resetIdleSession("owner");
  vi.setSystemTime(signedInAt + IDLE_TIMEOUT);
  const expire = vi.fn();
  stop = watchIdleSession("owner", expire, signedInAt);
  expect(expire).toHaveBeenCalledOnce();
});

it("连续指针移动每秒最多写一次存储", () => {
  const sets: string[] = [];
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      sets.push(`${key}:${value}`);
      storage.set(key, value);
    },
  });
  const expire = vi.fn();
  stop = watchIdleSession("owner", expire);
  const afterStart = sets.length;
  window.dispatchEvent(new Event("pointermove"));
  window.dispatchEvent(new Event("pointermove"));
  expect(sets.length).toBe(afterStart + 1);
  vi.advanceTimersByTime(1000);
  window.dispatchEvent(new Event("pointermove"));
  expect(sets.length).toBe(afterStart + 2);
  expect(expire).not.toHaveBeenCalled();
});

it("只有真实操作才算活动，焦点和别的标签页同步不会再次上报", () => {
  const expire = vi.fn();
  const activity = vi.fn();
  stop = watchIdleSession("owner", expire, undefined, activity);
  window.dispatchEvent(new Event("focus"));
  window.dispatchEvent(new Event("storage"));
  expect(activity).not.toHaveBeenCalled();
  for (const name of ["pointerdown", "keydown", "scroll", "touchstart"]) {
    window.dispatchEvent(new Event(name));
  }
  expect(activity).toHaveBeenCalledTimes(4);
});

it("回到前台算活动，但过期后的第一次回到前台不能续期", () => {
  const expire = vi.fn();
  const activity = vi.fn();
  stop = watchIdleSession("owner", expire, undefined, activity);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(activity).toHaveBeenCalledOnce();
  vi.setSystemTime(Date.now() + IDLE_TIMEOUT);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(expire).toHaveBeenCalledOnce();
  expect(activity).toHaveBeenCalledOnce();
});

it("其他标签页的登出标记会结束本页计时", () => {
  const expire = vi.fn();
  stop = watchIdleSession("owner", expire);
  window.dispatchEvent(
    new StorageEvent("storage", { key: "bingetrack:logout:v1:owner", newValue: String(Date.now()) }),
  );
  expect(expire).toHaveBeenCalledOnce();
  expire.mockClear();
  window.dispatchEvent(new StorageEvent("storage", { key: "bingetrack:logout:v1:owner", newValue: null }));
  expect(expire).not.toHaveBeenCalled();
});

it("另一个标签页的广播操作可以续期", () => {
  const instances: Array<{
    onmessage: ((event: { data: unknown }) => void) | null;
    postMessage: (data: unknown) => void;
  }> = [];
  class FakeChannel {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    constructor() {
      instances.push(this);
    }
    postMessage(data: unknown) {
      for (const other of instances) {
        if (other !== this) other.onmessage?.({ data });
      }
    }
    close() {
      const index = instances.indexOf(this);
      if (index >= 0) instances.splice(index, 1);
    }
  }
  vi.stubGlobal("BroadcastChannel", FakeChannel);
  const expire = vi.fn();
  stop = watchIdleSession("owner", expire);
  vi.advanceTimersByTime(20 * 60 * 1000);
  const sender = new FakeChannel();
  sender.postMessage({ type: "activity", userId: "someone-else", at: Date.now() });
  sender.postMessage({ type: "activity", userId: "owner", at: Date.now() });
  sender.close();
  vi.advanceTimersByTime(20 * 60 * 1000);
  expect(expire).not.toHaveBeenCalled();
  vi.advanceTimersByTime(10 * 60 * 1000);
  expect(expire).toHaveBeenCalledOnce();
});

it("一个标签页登出时，另一个标签页的计时也结束", () => {
  const instances: Array<{
    onmessage: ((event: { data: unknown }) => void) | null;
    postMessage: (data: unknown) => void;
  }> = [];
  class FakeChannel {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    constructor() {
      instances.push(this);
    }
    postMessage(data: unknown) {
      for (const other of instances) {
        if (other !== this) other.onmessage?.({ data });
      }
    }
    close() {
      const index = instances.indexOf(this);
      if (index >= 0) instances.splice(index, 1);
    }
  }
  vi.stubGlobal("BroadcastChannel", FakeChannel);

  const first = vi.fn();
  const second = vi.fn();
  const stopFirst = watchIdleSession("owner", first);
  stop = watchIdleSession("owner", second);
  signalIdleLogout("owner");
  expect(first).toHaveBeenCalledOnce();
  expect(second).toHaveBeenCalledOnce();
  stopFirst();
});
