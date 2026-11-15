import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomeStatStrip from "@/components/dashboard/HomeStatStrip";

describe("HomeStatStrip", () => {
  it("shows the four billboard stats, including an empty year", () => {
    const { rerender } = render(
      <HomeStatStrip
        runtimePercent={66}
        totalMovies={67}
        watchedMovies={60}
        unwatchedMovies={7}
        totalSeries={8}
        watchedSeries={4}
        watchingSeries={3}
        episodePercent={54}
        watchedEpisodes={132}
        totalEpisodes={245}
      />,
    );
    expect(screen.getByRole("progressbar", { name: "完成进度 66%" })).toHaveAttribute("aria-valuenow", "66");
    expect(screen.getByText("已看 60 · 想看 7")).toBeInTheDocument();
    expect(screen.getByText("已看 4 · 在看 3")).toBeInTheDocument();
    expect(screen.getByText("132 / 245 集")).toBeInTheDocument();

    rerender(
      <HomeStatStrip
        runtimePercent={0}
        totalMovies={0}
        watchedMovies={0}
        unwatchedMovies={0}
        totalSeries={0}
        watchedSeries={0}
        watchingSeries={0}
        episodePercent={0}
        watchedEpisodes={0}
        totalEpisodes={0}
      />,
    );
    expect(screen.getByText("0 / 0 集")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "完成进度 0%" })).toHaveAttribute("aria-valuenow", "0");
  });
});
