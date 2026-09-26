import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import ExpandableCastList from "@/components/ExpandableCastList";

test("renders placeholder when casts list is empty", () => {
  render(<ExpandableCastList casts={[]} />);
  expect(screen.getByText("-")).toBeInTheDocument();
});

test("renders all casts without toggle button when count <= initialLimit", () => {
  const casts = ["演员1", "演员2", "演员3"];
  render(<ExpandableCastList casts={casts} initialLimit={12} />);
  expect(screen.getByText("演员1")).toBeInTheDocument();
  expect(screen.getByText("演员2")).toBeInTheDocument();
  expect(screen.getByText("演员3")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("collapses casts beyond limit and toggles expansion on click", () => {
  const casts = Array.from({ length: 15 }, (_, i) => `演员${i + 1}`);
  render(<ExpandableCastList casts={casts} initialLimit={12} />);

  // First 12 should be visible
  expect(screen.getByText("演员1")).toBeInTheDocument();
  expect(screen.getByText("演员12")).toBeInTheDocument();
  // 13th should not be visible
  expect(screen.queryByText("演员13")).not.toBeInTheDocument();

  // Button should say "展开剩余 3 位演员"
  const toggleBtn = screen.getByRole("button", { name: "展开剩余 3 位演员" });
  expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

  // Click to expand
  fireEvent.click(toggleBtn);
  expect(screen.getByText("演员13")).toBeInTheDocument();
  expect(screen.getByText("演员15")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "收起部分演员" })).toHaveAttribute("aria-expanded", "true");

  // Click to collapse
  fireEvent.click(screen.getByRole("button", { name: "收起部分演员" }));
  expect(screen.queryByText("演员13")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "展开剩余 3 位演员" })).toHaveAttribute("aria-expanded", "false");
});


test("shows the character beside each actor while the link searches only the actor", () => {
  render(<ExpandableCastList casts={["演员1", "演员2"]} characters={["角色甲", null]} />);
  const link = screen.getByRole("link", { name: "演员1 饰 角色甲" });
  expect(link).toHaveAttribute("href", "/search?q=%E6%BC%94%E5%91%981&type=actor");
  expect(screen.getByRole("link", { name: "演员2" })).toBeInTheDocument();
});
