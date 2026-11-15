import { afterEach, describe, expect, it, vi } from "vitest";
import { handlePageDataError } from "@/lib/functions/page-data";

describe("页面数据加载失败", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("运行期重新抛出，让 ISR 继续提供上一次成功的页面", () => {
    const error = new Error("db down");
    expect(() => handlePageDataError("home", error)).toThrow(error);
  });

  it("构建期只记录并降级，避免数据库不可用阻断构建", () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    const error = new Error("db down");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => handlePageDataError("home", error)).not.toThrow();
    expect(log).toHaveBeenCalledWith("Failed to fetch home data during build, falling back to empty content:", error);
  });
});
