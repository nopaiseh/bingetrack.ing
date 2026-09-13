import { describe, expect, it, vi } from "vitest";
import { isTransientError, withRetry } from "@/lib/functions/retry";
import { MediaRepositoryError } from "@/lib/functions/media-repo";

describe("isTransientError", () => {
  it("识别 504 Gateway Timeout 错误", () => {
    expect(isTransientError({ message: "Gateway Timeout" })).toBe(true);
    expect(isTransientError({ status: 504 })).toBe(true);
    expect(isTransientError({ code: "504" })).toBe(true);
    expect(isTransientError(new MediaRepositoryError("fetch media list", { message: "Gateway Timeout" }))).toBe(true);
  });

  it("识别 502 Bad Gateway 和 503 Service Unavailable", () => {
    expect(isTransientError({ message: "Bad Gateway" })).toBe(true);
    expect(isTransientError({ status: 502 })).toBe(true);
    expect(isTransientError({ message: "Service Unavailable" })).toBe(true);
    expect(isTransientError({ status: 503 })).toBe(true);
  });

  it("识别网络与连接故障（ETIMEDOUT, ECONNRESET, fetch failed）", () => {
    expect(isTransientError(new Error("fetch failed"))).toBe(true);
    expect(isTransientError({ code: "ETIMEDOUT" })).toBe(true);
    expect(isTransientError({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientError(new Error("socket hang up"))).toBe(true);
    expect(isTransientError(new Error("canceling statement due to statement timeout"))).toBe(true);
  });

  it("识别深层嵌套的 cause 错误", () => {
    const rootError = { message: "Gateway Timeout" };
    const wrappedOnce = new MediaRepositoryError("query", rootError);
    const wrappedTwice = new Error("outer error", { cause: wrappedOnce });
    expect(isTransientError(wrappedTwice)).toBe(true);
  });

  it("对非瞬时错误返回 false", () => {
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
    expect(isTransientError({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isTransientError({ code: "PGRST205", message: "table missing" })).toBe(false);
    expect(isTransientError(new Error("Record not found"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("无错误时正常返回结果", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await withRetry(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("遇到瞬时错误时重试并在重试后成功", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new MediaRepositoryError("fetch", { message: "Gateway Timeout" }))
      .mockResolvedValueOnce("recovered");

    const onRetry = vi.fn();
    const result = await withRetry(fn, { maxRetries: 2, initialDelayMs: 10, onRetry });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(MediaRepositoryError), 1, 10);
  });

  it("非瞬时错误立即抛出，不进行重试", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Invalid parameters"));
    const onRetry = vi.fn();

    await expect(withRetry(fn, { maxRetries: 3, initialDelayMs: 10, onRetry })).rejects.toThrow("Invalid parameters");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("超过最大重试次数后抛出最后的错误", async () => {
    const timeoutErr = new MediaRepositoryError("fetch", { message: "Gateway Timeout" });
    const fn = vi.fn().mockRejectedValue(timeoutErr);
    const onRetry = vi.fn();

    await expect(withRetry(fn, { maxRetries: 2, initialDelayMs: 10, onRetry })).rejects.toBe(timeoutErr);
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});
