import { afterEach, expect, test, vi } from "vitest";
import { scrollBehavior } from "@/lib/scroll-behavior";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("prefers-reduced-motion 为真时返回 auto", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion: reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  expect(scrollBehavior()).toBe("auto");
});

test("prefers-reduced-motion 为假时返回 smooth", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  expect(scrollBehavior()).toBe("smooth");
});

test("matchMedia 不可用时回退到 smooth", () => {
  vi.stubGlobal("matchMedia", undefined);
  expect(scrollBehavior()).toBe("smooth");
});
