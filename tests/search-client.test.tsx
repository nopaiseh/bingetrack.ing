import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { useSyncExternalStore } from "react";
import SearchClient from "@/app/search/SearchClient";
import { buildMediaSearchQuery } from "@/lib/api/search-state";

vi.mock("next/navigation", () => ({
  usePathname: () => "/search",
  useSearchParams: () => new URLSearchParams(useSyncExternalStore(
    (notify) => {
      window.addEventListener("popstate", notify);
      return () => window.removeEventListener("popstate", notify);
    },
    () => window.location.search,
  )),
}));

// Mirror Next's History API integration without starting the App Router.
beforeEach(() => {
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method].bind(window.history);
    vi.spyOn(window.history, method).mockImplementation((...args) => {
      original(...args);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  }
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); });

const options = { genres: [], regions: [], languages: [], years: [] };
const resultFor = (search: string) => ({
  rows: [], total: 62, error: null, key: buildMediaSearchQuery(new URLSearchParams(search)),
});

test("hydrating or remounting page two preserves its URL without another request", async () => {
  vi.useFakeTimers();
  try {
    window.history.replaceState(null, "", "/search?q=电影&page=2");
    const props = { initialOptions: options, initialResult: resultFor(window.location.search) };
    const view = render(<SearchClient {...props} />);
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(new URLSearchParams(window.location.search).get("page")).toBe("2");
    expect(fetch).not.toHaveBeenCalled();
    view.unmount();
    render(<SearchClient {...props} />);
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(new URLSearchParams(window.location.search).get("page")).toBe("2");
    expect(fetch).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});

test("editing the query resets pagination and makes one request for the new URL", async () => {
  window.history.replaceState(null, "", "/search?page=2");
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ rows: [], total: 0 })));
  render(<SearchClient initialOptions={options} initialResult={resultFor(window.location.search)} />);
  fireEvent.change(screen.getByRole("textbox", { name: "搜索媒体" }), { target: { value: "王家卫" } });
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]), "http://localhost");
  expect(url.searchParams.get("q")).toBe("王家卫");
  expect(url.searchParams.get("offset")).toBe("0");
  expect(new URLSearchParams(window.location.search).has("page")).toBe(false);
  await screen.findByText("找到 0 部作品");
});

test("history restoration updates the query without deleting its page", async () => {
  window.history.replaceState(null, "", "/search?q=新&page=1");
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ rows: [], total: 62 })));
  render(<SearchClient initialOptions={options} initialResult={resultFor(window.location.search)} />);
  act(() => { window.history.replaceState(null, "", "/search?q=旧&page=2"); });
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("textbox", { name: "搜索媒体" })).toHaveValue("旧");
  expect(new URLSearchParams(window.location.search).get("page")).toBe("2");
  await screen.findByText("找到 62 部作品");
});
