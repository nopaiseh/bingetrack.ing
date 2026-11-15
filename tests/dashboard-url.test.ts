import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getServerUrlSnapshot,
  getUrlSnapshot,
  subscribeToUrl,
  writeDashboardParams,
} from "@/components/dashboard/dashboard-url";

describe("dashboard url", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("reads an empty query during prerender and the live query in the browser", () => {
    expect(getServerUrlSnapshot()).toBe("");
    window.history.replaceState(null, "", "/?view=movies");
    expect(getUrlSnapshot()).toBe("?view=movies");
    window.history.replaceState(null, "", "/");
    expect(getUrlSnapshot()).toBe("");
  });

  it("writes view and year, drops defaults, and keeps unrelated params and the hash", () => {
    const replace = vi.spyOn(window.history, "replaceState");
    const push = vi.spyOn(window.history, "pushState");
    window.history.replaceState(null, "", "/home?foo=1#section");

    writeDashboardParams("movies", "2023");
    expect(window.location.pathname).toBe("/home");
    expect(window.location.search).toBe("?foo=1&view=movies&year=2023");
    expect(window.location.hash).toBe("#section");

    writeDashboardParams("overview", "All Time");
    expect(window.location.search).toBe("?foo=1");
    expect(window.location.hash).toBe("#section");
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalled();
    replace.mockRestore();
    push.mockRestore();
  });

  it("notifies subscribers on write and on popstate, then stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToUrl(listener);

    writeDashboardParams("tv-shows", "2020");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("?view=tv-shows&year=2020");

    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    writeDashboardParams("movies", "2021");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
