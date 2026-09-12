import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { useSyncExternalStore } from "react";
import SearchClient from "@/app/search/SearchClient";
import { buildMediaSearchQuery } from "@/lib/api/search-state";

vi.mock("next/navigation", /* 模拟搜索路由，并使搜索参数订阅浏览器地址变化。 */ () => ({
  usePathname: /* 固定返回搜索页路径。 */ () => "/search",
  useRouter: () => ({
    push: (href: string) => { window.history.pushState(null, "", href); },
    replace: (href: string) => { window.history.replaceState(null, "", href); },
  }),
  useSearchParams: /* 用外部存储订阅读取地址中的查询串，并转换为 URLSearchParams。 */ () => new URLSearchParams(useSyncExternalStore(
    /** 订阅 popstate 事件，让地址变更通知测试中的搜索组件。 */
    (notify) => {
      window.addEventListener("popstate", notify);
      return /* 解除 popstate 订阅。 */ () => window.removeEventListener("popstate", notify);
    },
    /** 返回当前查询串作为外部存储快照。 */
    () => window.location.search,
  )),
}));

// 模拟 Next.js 对 History API 的同步：写入地址后通知订阅者读取新参数。
beforeEach(/* 在每次测试前模拟 History API 的通知行为，并替换全局 fetch。 */ () => {
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method].bind(window.history);
    vi.spyOn(window.history, method).mockImplementation(/* 保留原始地址写入操作，再发送 popstate 通知组件同步参数。 */ (...args) => {
      original(...args);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  }
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(/* 恢复测试替换的全局变量。 */ () => { vi.unstubAllGlobals(); });

const options = { genres: [], regions: [], languages: [], years: [] };
/** 构造带指定 URL 查询键的空首屏结果，并提供可分页的固定总数。 */
const resultFor = (search: string) => ({
  rows: [], total: 62, error: null, key: buildMediaSearchQuery(new URLSearchParams(search)),
});

test("hydrating or remounting page two preserves its URL without another request", /* 验证第二页首屏挂载及再次挂载都保留地址，且不会重复请求。 */ async () => {
  vi.useFakeTimers();
  try {
    window.history.replaceState(null, "", "/search?q=电影&page=2");
    const props = { initialOptions: options, initialResult: resultFor(window.location.search) };
    const view = render(<SearchClient {...props} />);
    await act(/* 推进模拟时间，让首轮挂载的防抖任务完成。 */ () => vi.advanceTimersByTimeAsync(500));
    expect(new URLSearchParams(window.location.search).get("page")).toBe("2");
    expect(fetch).not.toHaveBeenCalled();
    view.unmount();
    render(<SearchClient {...props} />);
    await act(/* 推进模拟时间，让重新挂载后的防抖任务完成。 */ () => vi.advanceTimersByTimeAsync(500));
    expect(new URLSearchParams(window.location.search).get("page")).toBe("2");
    expect(fetch).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});

test("editing the query resets pagination and makes one request for the new URL", /* 验证修改搜索词会清除旧页码，并只请求一次新的查询。 */ async () => {
  window.history.replaceState(null, "", "/search?page=2");
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ rows: [], total: 0 })));
  render(<SearchClient initialOptions={options} initialResult={resultFor(window.location.search)} />);
  fireEvent.change(screen.getByRole("textbox", { name: "搜索媒体" }), { target: { value: "王家卫" } });
  await waitFor(/* 等待并断言 fetch 恰好调用一次。 */ () => expect(fetch).toHaveBeenCalledTimes(1));
  const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]), "http://localhost");
  expect(url.searchParams.get("q")).toBe("王家卫");
  expect(url.searchParams.get("offset")).toBe("0");
  expect(new URLSearchParams(window.location.search).has("page")).toBe(false);
  await screen.findByText("找到 0 部作品");
});

test("history restoration updates the query without deleting its page", /* 验证历史地址恢复时输入词同步更新，同时保留历史页码。 */ async () => {
  window.history.replaceState(null, "", "/search?q=新&page=1");
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ rows: [], total: 62 })));
  render(<SearchClient initialOptions={options} initialResult={resultFor(window.location.search)} />);
  act(/* 在 React 更新边界内恢复旧搜索词和第二页地址。 */ () => { window.history.replaceState(null, "", "/search?q=旧&page=2"); });
  await waitFor(/* 等待历史地址变化触发的唯一一次请求。 */ () => expect(fetch).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("textbox", { name: "搜索媒体" })).toHaveValue("旧");
  expect(new URLSearchParams(window.location.search).get("page")).toBe("2");
  await screen.findByText("找到 62 部作品");
});

test("failed search can retry the same query and recover", /* 模拟网络失败后恢复，验证重试保留条件且不会重复请求。 */ async () => {
  window.history.replaceState(null, "", "/search?q=电影");
  vi.spyOn(console, "error").mockImplementation(/* 静默预期错误。 */ () => {});
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError("offline"))
    .mockResolvedValueOnce(new Response(JSON.stringify({ rows: [], total: 0 })));
  render(<SearchClient initialOptions={options} initialResult={resultFor("?q=旧")} />);
  fireEvent.click(await screen.findByRole("button", { name: "重试" }));
  await screen.findByText("找到 0 部作品");
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe(vi.mocked(fetch).mock.calls[1][0]);
});

test("overlong shared query explains the limit without requesting", /* 超长链接不再触发无效请求，修改后可恢复。 */ async () => {
  window.history.replaceState(null, "", `/search?q=${"a".repeat(101)}`);
  render(<SearchClient initialOptions={options} initialResult={resultFor(window.location.search)} />);
  expect(screen.getByRole("tooltip")).toHaveTextContent("搜索词最多 100 个字符，请缩短后再搜索。");
  expect(screen.getByRole("textbox", { name: "搜索媒体" })).toHaveAttribute("aria-invalid", "true");
  expect(fetch).not.toHaveBeenCalled();
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ rows: [], total: 0 })));
  fireEvent.change(screen.getByRole("textbox", { name: "搜索媒体" }), { target: { value: "电影" } });
  await screen.findByText("找到 0 部作品");
});

test("invalid filters show actionable validation feedback", /* 参数错误不再误报为暂时服务故障。 */ async () => {
  window.history.replaceState(null, "", "/search?q=电影");
  vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 400 }));
  render(<SearchClient initialOptions={options} initialResult={resultFor("?q=旧")} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("搜索条件无效");
});

test("filter selection and sort direction are accessible", /* 验证切换后读屏可识别选中状态及排序方向。 */ async () => {
  window.history.replaceState(null, "", "/search");
  vi.mocked(fetch).mockImplementation(/* 每次返回独立响应。 */ async () => new Response(JSON.stringify({ rows: [], total: 0 })));
  render(<SearchClient initialOptions={options} initialResult={resultFor("")} />);
  const movie = screen.getByRole("button", { name: "电影" });
  expect(movie).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(movie);
  expect(movie).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "日期，降序" }));
  expect(screen.getByRole("button", { name: "日期，升序" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "收起筛选" }));
  expect(screen.getByRole("button", { name: "高级筛选" })).toHaveAttribute("aria-expanded", "false");
  await screen.findByText("找到 0 部作品");
});


test("search limit tooltip only appears above 100 characters", /* 正常输入不占提示空间，超长输入不更新地址或发送请求，缩短后隐藏提示。 */ async () => {
  window.history.replaceState(null, "", "/search");
  render(<SearchClient initialOptions={options} initialResult={resultFor("")} />);
  const input = screen.getByRole("textbox", { name: "搜索媒体" });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  vi.useFakeTimers();
  try {
    fireEvent.change(input, { target: { value: "a".repeat(100) } });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "a".repeat(101) } });
    expect(screen.getByRole("tooltip")).toHaveTextContent("最多 100 个字符");
    await act(/* 等待防抖窗口，确认没有超长请求。 */ () => vi.advanceTimersByTimeAsync(500));
    expect(fetch).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
    fireEvent.change(input, { target: { value: "a".repeat(100) } });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});
