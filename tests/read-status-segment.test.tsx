import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReadStatusSegment from "@/components/ReadStatusSegment";

describe("ReadStatusSegment", () => {
  it("高亮当前阅读状态，未知值回退想读", () => {
    const { rerender } = render(<ReadStatusSegment status="in_progress" />);
    const group = screen.getByRole("group", { name: "阅读状态" });
    expect(group).toBeInTheDocument();
    expect(screen.getByText("在读")).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("想读")).not.toHaveAttribute("aria-current");

    rerender(<ReadStatusSegment status="watched" />);
    expect(screen.getByText("读过")).toHaveAttribute("aria-current", "true");

    rerender(<ReadStatusSegment status={null} />);
    expect(screen.getByText("想读")).toHaveAttribute("aria-current", "true");
  });
});
