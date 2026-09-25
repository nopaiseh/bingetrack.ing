import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import UnsavedGuard from "@/app/manage/UnsavedGuard";

describe("UnsavedGuard browser back", () => {
  let push: ReturnType<typeof vi.spyOn>;
  let back: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    push = vi.spyOn(window.history, "pushState").mockImplementation(() => {});
    back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("有未保存修改时压入一条同地址记录，重新启用时复用而不堆积", () => {
    const view = render(<UnsavedGuard dirty={false} />);
    expect(push).not.toHaveBeenCalled();
    view.rerender(<UnsavedGuard dirty />);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenLastCalledWith(null, "", window.location.href);
    // 保存期间关闭、失败后重新启用。
    view.rerender(<UnsavedGuard dirty={false} />);
    view.rerender(<UnsavedGuard dirty />);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("后退时取消确认会重新压入记录并留在本页", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<UnsavedGuard dirty />);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(2);
    expect(back).not.toHaveBeenCalled();
  });

  it("后退时确认离开会再后退一步，且不再重复询问", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<UnsavedGuard dirty />);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(back).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(window.confirm).toHaveBeenCalledTimes(1);
  });

  it("没有未保存修改时不拦截后退", () => {
    vi.spyOn(window, "confirm");
    render(<UnsavedGuard dirty={false} />);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(window.confirm).not.toHaveBeenCalled();
  });
});
