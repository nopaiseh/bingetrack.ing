import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomeStatStrip from "@/components/dashboard/HomeStatStrip";
import { deriveDashboardStats } from "@/components/dashboard/dashboard-stats";
import type { Summary } from "@/lib/types";

describe("HomeStatStrip", () => {
  it("reads the all-time stats object, including an empty year", () => {
    const filled = deriveDashboardStats(
      [
        {
          release_year: "All Time",
          watched_movies: 60,
          unwatched_movies: 7,
          watched_series: 4,
          watching_series: 3,
          total_watched_runtime: 66,
          total_runtime: 100,
          watched_series_episodes: 132,
          total_series_episodes: 245,
        } as Summary,
      ],
      "All Time",
      { movies: {}, shows: {} },
    );
    const { rerender } = render(<HomeStatStrip stats={filled} />);
    expect(screen.getByRole("progressbar", { name: "完成进度 66%" })).toHaveAttribute("aria-valuenow", "66");
    expect(screen.getByText("已看 60 · 想看 7")).toBeInTheDocument();
    expect(screen.getByText("已看 4 · 在看 3")).toBeInTheDocument();
    expect(screen.getByText("132 / 245 集")).toBeInTheDocument();

    rerender(<HomeStatStrip stats={deriveDashboardStats([], "All Time", { movies: {}, shows: {} })} />);
    expect(screen.getByText("0 / 0 集")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "完成进度 0%" })).toHaveAttribute("aria-valuenow", "0");
  });
});
