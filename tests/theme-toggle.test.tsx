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
  expect(screen.getByRole("button", { name: "切换为红毯经典主题" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "切换为赛博霓虹主题" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "切换为复古胶片主题" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "切换为黑曜钛白主题" })).toBeInTheDocument();
});

test("switches theme on click and persists to document and localStorage", async () => {
  const user = userEvent.setup();
  render(<ThemeToggle />);

  const cyberButton = screen.getByRole("button", { name: "切换为赛博霓虹主题" });
  await user.click(cyberButton);

  expect(document.documentElement.getAttribute("data-theme")).toBe("cyber");
  expect(localStorage.getItem("bingetrack-theme")).toBe("cyber");
  expect(cyberButton).toHaveAttribute("aria-pressed", "true");

  const noirButton = screen.getByRole("button", { name: "切换为黑曜钛白主题" });
  await user.click(noirButton);

  expect(document.documentElement.getAttribute("data-theme")).toBe("noir");
  expect(localStorage.getItem("bingetrack-theme")).toBe("noir");
  expect(noirButton).toHaveAttribute("aria-pressed", "true");

  const defaultButton = screen.getByRole("button", { name: "切换为红毯经典主题" });
  await user.click(defaultButton);

  expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  expect(localStorage.getItem("bingetrack-theme")).toBeNull();
  expect(defaultButton).toHaveAttribute("aria-pressed", "true");
});
