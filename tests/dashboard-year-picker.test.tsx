import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import DashboardYearPicker from "@/components/DashboardYearPicker";

test(
  "filters years and selects an option with the keyboard",
  /* 验证年份输入筛选后，可以使用键盘选中候选年份。 */ async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<DashboardYearPicker years={["All Time", 2025, 2024, 2023]} selectedYear="All Time" onSelect={onSelect} />);

    const picker = screen.getByRole("combobox", { name: "筛选年份" });
    await user.click(picker);
    expect(picker).toHaveAttribute("aria-expanded", "true");

    await user.type(picker, "2024");
    expect(screen.getByRole("option", { name: "2024" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "2025" })).not.toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("2024");
    expect(picker).toHaveAttribute("aria-expanded", "false");
  },
);

test(
  "closes without selecting when Escape is pressed",
  /* 验证 Escape 只关闭年份列表，不触发选择回调。 */ async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<DashboardYearPicker years={[2025, 2024]} selectedYear="2025" onSelect={onSelect} />);

    const picker = screen.getByRole("combobox", { name: "筛选年份" });
    await user.click(picker);
    await user.keyboard("{Escape}");

    expect(picker).toHaveAttribute("aria-expanded", "false");
    expect(onSelect).not.toHaveBeenCalled();
  },
);

test(
  "aria-controls only points at the year list while it is open",
  /* 收起时不写 aria-controls，避免指向不在 DOM 中的 id；展开时关联存在的列表。 */ async () => {
    const user = userEvent.setup();
    render(<DashboardYearPicker years={[2025, 2024]} selectedYear="2025" onSelect={vi.fn()} />);

    const picker = screen.getByRole("combobox", { name: "筛选年份" });
    expect(picker).toHaveAttribute("aria-expanded", "false");
    expect(picker).not.toHaveAttribute("aria-controls");

    await user.click(picker);
    expect(picker).toHaveAttribute("aria-expanded", "true");
    const controls = picker.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls!)).not.toBeNull();
  },
);

test(
  "displays '全时段' when 'All Time' is selected",
  /* 验证选中 All Time 时输入框显示为全时段 */ () => {
    render(<DashboardYearPicker years={["All Time", 2025, 2024]} selectedYear="All Time" onSelect={vi.fn()} />);
    const picker = screen.getByRole("combobox", { name: "筛选年份" });
    expect(picker).toHaveValue("全时段");
  },
);
