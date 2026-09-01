import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import DashboardYearPicker from "@/components/DashboardYearPicker";

test("filters years and selects an option with the keyboard", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(
    <DashboardYearPicker
      years={["All Time", 2025, 2024, 2023]}
      selectedYear="All Time"
      onSelect={onSelect}
    />,
  );

  const picker = screen.getByRole("combobox", { name: "筛选年份" });
  await user.click(picker);
  expect(picker).toHaveAttribute("aria-expanded", "true");

  await user.type(picker, "2024");
  expect(screen.getByRole("option", { name: "2024" })).toBeVisible();
  expect(screen.queryByRole("option", { name: "2025" })).not.toBeInTheDocument();

  await user.keyboard("{Enter}");
  expect(onSelect).toHaveBeenCalledWith("2024");
  expect(picker).toHaveAttribute("aria-expanded", "false");
});

test("closes without selecting when Escape is pressed", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(
    <DashboardYearPicker years={[2025, 2024]} selectedYear="2025" onSelect={onSelect} />,
  );

  const picker = screen.getByRole("combobox", { name: "筛选年份" });
  await user.click(picker);
  await user.keyboard("{Escape}");

  expect(picker).toHaveAttribute("aria-expanded", "false");
  expect(onSelect).not.toHaveBeenCalled();
});
