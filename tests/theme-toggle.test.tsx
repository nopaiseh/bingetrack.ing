import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import ThemeToggle from "@/components/ThemeToggle";

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  });
  document.documentElement.removeAttribute("data-theme");
});

test("renders theme toggle buttons with accessible roles", () => {
  render(<ThemeToggle />);
  expect(screen.getByRole("group", { name: "影院氛围主题" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "切换为极光玫瑰主题" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "切换为深海霓虹主题" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "切换为金色时刻主题" })).toBeInTheDocument();
  expect(screen.getAllByRole("button")).toHaveLength(3);
});

test("switches theme on click and persists to document and localStorage", async () => {
  const user = userEvent.setup();
  render(<ThemeToggle />);

  const lagoonButton = screen.getByRole("button", { name: "切换为深海霓虹主题" });
  await user.click(lagoonButton);

  expect(document.documentElement.getAttribute("data-theme")).toBe("lagoon");
  expect(localStorage.getItem("bingetrack-theme")).toBe("lagoon");
  expect(lagoonButton).toHaveAttribute("aria-pressed", "true");

  const goldenButton = screen.getByRole("button", { name: "切换为金色时刻主题" });
  await user.click(goldenButton);

  expect(document.documentElement.getAttribute("data-theme")).toBe("golden");
  expect(localStorage.getItem("bingetrack-theme")).toBe("golden");
  expect(goldenButton).toHaveAttribute("aria-pressed", "true");

  const defaultButton = screen.getByRole("button", { name: "切换为极光玫瑰主题" });
  await user.click(defaultButton);

  expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  expect(localStorage.getItem("bingetrack-theme")).toBeNull();
  expect(defaultButton).toHaveAttribute("aria-pressed", "true");
});

test("首帧脚本忽略已下线的旧主题并保留默认主题", async () => {
  const { THEME_INIT_SCRIPT } = await import("@/lib/themes");
  for (const retired of ["cyber", "sepia", "noir"]) {
    storage.set("bingetrack-theme", retired);
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  }

  storage.set("bingetrack-theme", "lagoon");
  new Function(THEME_INIT_SCRIPT)();
  expect(document.documentElement.getAttribute("data-theme")).toBe("lagoon");
});
