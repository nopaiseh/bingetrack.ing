import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import Navbar from "@/components/Navbar";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/movies",
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockClear();
});

test("marks the current section and toggles the mobile menu", async () => {
  const user = userEvent.setup();
  render(<Navbar />);

  expect(screen.getAllByRole("link", { name: "电影" })).toHaveLength(1);
  expect(document.querySelector("#mobile-navigation")).toHaveAttribute("inert");

  const menuButton = screen.getByRole("button", { name: "打开导航菜单" });
  await user.click(menuButton);
  expect(screen.getByRole("button", { name: "关闭导航菜单" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  const movieLinks = screen.getAllByRole("link", { name: "电影" });
  expect(movieLinks).toHaveLength(2);
  for (const link of movieLinks) {
    expect(link).toHaveClass("text-red-500");
    expect(link).toHaveAttribute("aria-current", "page");
  }
});

test("submits trimmed desktop search text to the search route", async () => {
  const user = userEvent.setup();
  render(<Navbar />);

  const searchInputs = screen.getAllByPlaceholderText("搜索");
  await user.type(searchInputs[0], "  沙丘  ");
  await user.click(screen.getAllByRole("button", { name: "搜索" })[0]);

  expect(push).toHaveBeenCalledWith("/search?q=%E6%B2%99%E4%B8%98");
});
