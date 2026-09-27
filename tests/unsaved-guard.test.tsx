import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import UnsavedGuard from "@/app/(admin)/manage/UnsavedGuard";

/** 模拟浏览器后退：离开守卫记录，回到下方未标记的同地址记录，再触发 popstate。 */
function goBackToEntryBelow() {
  History.prototype.replaceState.call(window.history, null, "", window.location.href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

describe("UnsavedGuard browser back", () => {
  let push: ReturnType<typeof vi.spyOn>;
  let back: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // 补丁装在 history 实例上且跨用例保留，用原型上的原生方法清掉上一用例留下的守卫标记。
    History.prototype.replaceState.call(window.history, null, "", "/manage/media/1");
    push = vi.spyOn(window.history, "pushState");
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
    expect(push).toHaveBeenLastCalledWith({ __manageGuard: true }, "", window.location.href);
    // 保存期间关闭、失败后重新启用。
    view.rerender(<UnsavedGuard dirty={false} />);
    view.rerender(<UnsavedGuard dirty />);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("后退时取消确认会重新压入记录并留在本页", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<UnsavedGuard dirty />);
    goBackToEntryBelow();
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(2);
    expect(window.history.state).toMatchObject({ __manageGuard: true });
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

  it("后退时确认离开后不再由 beforeunload 重复询问", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<UnsavedGuard dirty />);
    window.dispatchEvent(new PopStateEvent("popstate"));
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });

  it("点击站内链接只询问一次，取消时链接自身的处理不会执行", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onClick = vi.fn();
    const view = render(<><UnsavedGuard dirty /><a href="/manage" onClick={onClick}>列表</a></>);
    view.getByText("列表").click();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("在守卫记录上跳转会替换它，离开后后退一次就回到编辑页之前", () => {
    const view = render(<UnsavedGuard dirty />);
    const length = window.history.length;
    view.rerender(<UnsavedGuard dirty={false} />);
    window.history.pushState({}, "", "/manage?type=movie");
    expect(window.history.length).toBe(length);
    expect(window.location.search).toBe("?type=movie");
  });

  it("刷新当前页替换状态时保留守卫标记", () => {
    render(<UnsavedGuard dirty />);
    window.history.replaceState({ other: 1 }, "", window.location.href);
    expect(window.history.state).toEqual({ other: 1, __manageGuard: true });
  });

  it("守卫失效后留下的同地址记录，后退经过时自动跳过", () => {
    const view = render(<UnsavedGuard dirty />);
    view.unmount();
    goBackToEntryBelow();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("没有未保存修改时不拦截后退", () => {
    vi.spyOn(window, "confirm");
    render(<UnsavedGuard dirty={false} />);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(window.confirm).not.toHaveBeenCalled();
  });
});
