import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SeasonRow from "@/components/SeasonRow";
import type { SeasonInfo } from "@/lib/types";

const mockSeasons: SeasonInfo[] = [
  {
    id: "season-1",
    seasonNumber: 1,
    title: "跑男（2010）",
    coverUrl: "https://image.tmdb.org/t/p/w500/season1.jpg",
    episodeCount: 10,
    watchedEpisodeCount: 10,
    releaseYearRange: "2010",
  },
  {
    id: "season-2",
    seasonNumber: 2,
    title: "第 2 季",
    alternateTitle: "Running Man",
    coverUrl: "",
    episodeCount: 8,
    watchedEpisodeCount: 3,
    releaseYearRange: "2011",
  },
  {
    id: "season-3",
    seasonNumber: 3,
    title: "第三季",
    coverUrl: "",
    episodeCount: 12,
    watchedEpisodeCount: 0,
    releaseYearRange: "2012 - 2013",
  },
];

describe("SeasonRow 文字季列表", () => {
  it("无季度数据时显示友好占位提示", () => {
    render(<SeasonRow seriesId="series-1" seasons={[]} />);
    expect(screen.getByText("暂无季集数据")).toBeInTheDocument();
    expect(screen.getByText("季度列表")).toBeInTheDocument();
  });

  it("用统一季名、原标题、年份、集数和进度条代替海报", () => {
    render(<SeasonRow seriesId="series-1" seasons={mockSeasons} />);

    expect(screen.getByText("共 3 季")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "向左滚动季度列表" })).not.toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 3, name: "第 1 季" })).toBeInTheDocument();
    expect(screen.getByText("跑男（2010）")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "第 2 季" })).toBeInTheDocument();
    expect(screen.getByText("Running Man")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "第 3 季" })).toBeInTheDocument();
    expect(screen.queryByText("第三季")).not.toBeInTheDocument();

    expect(screen.getByText("2010")).toBeInTheDocument();
    expect(screen.getByText("2011")).toBeInTheDocument();
    expect(screen.getByText("2012–2013")).toBeInTheDocument();
    expect(screen.getByText("10/10 集")).toBeInTheDocument();
    expect(screen.getByText("3/8 集")).toBeInTheDocument();
    expect(screen.getByText("12 集")).toBeInTheDocument();
    expect(screen.getByText("已看")).toBeInTheDocument();
    expect(screen.getByText("在看")).toBeInTheDocument();
    expect(screen.getByText("未看")).toBeInTheDocument();

    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(3);
    expect(bars[0]).toHaveAttribute("aria-valuenow", "100");
    expect(bars[1]).toHaveAttribute("aria-valuenow", "38");
    expect(bars[2]).toHaveAttribute("aria-valuenow", "0");

    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/shows/series-1/seasons/season-1");
    expect(links[1]).toHaveAttribute("href", "/shows/series-1/seasons/season-2");
    expect(links[2]).toHaveAttribute("href", "/shows/series-1/seasons/season-3");
  });
});
