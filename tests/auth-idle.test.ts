import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IDLE_TIMEOUT, resetIdleSession, watchIdleSession } from "@/lib/auth/idle";
let stop: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
});
afterEach(() => { stop?.(); vi.useRealTimers(); vi.unstubAllGlobals(); });
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
