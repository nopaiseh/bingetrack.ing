import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SeasonRow from "@/components/SeasonRow";
import type { SeasonInfo } from "@/lib/types";

const mockSeasons: SeasonInfo[] = [
  {
    id: "season-1",
    seasonNumber: 1,
    title: "第一季",
    coverUrl: "https://image.tmdb.org/t/p/w500/season1.jpg",
    episodeCount: 10,
    watchedEpisodeCount: 10,
    releaseYearRange: "2024",
  },
  {
    id: "season-2",
    seasonNumber: 2,
    title: "第二季",
    coverUrl: "",
    episodeCount: 8,
    watchedEpisodeCount: 3,
    releaseYearRange: "2025",
  },
  {
    id: "season-3",
    seasonNumber: 3,
    title: "第三季",
    coverUrl: "",
    episodeCount: 12,
    watchedEpisodeCount: 0,
    releaseYearRange: "2026",
  },
];

describe("SeasonRow 电视剧季列表横向平滑轮播", () => {
  it("无季度数据时显示友好占位提示", () => {
    render(<SeasonRow seriesId="series-1" seasons={[]} />);
    expect(screen.getByText("暂无季集数据")).toBeInTheDocument();
    expect(screen.getByText("季度列表")).toBeInTheDocument();
  });

  it("渲染季度卡片，包含季编号、标题、年份、集数及观看状态", () => {
    render(<SeasonRow seriesId="series-1" seasons={mockSeasons} />);

    expect(screen.getByText("共 3 季")).toBeInTheDocument();
    expect(screen.getByText("第一季")).toBeInTheDocument();
    expect(screen.getByText("第二季")).toBeInTheDocument();
    expect(screen.getByText("第三季")).toBeInTheDocument();

    expect(screen.getByText("第 1 季")).toBeInTheDocument();
    expect(screen.getByText("第 2 季")).toBeInTheDocument();
    expect(screen.getByText("第 3 季")).toBeInTheDocument();

    // 观看进度显示
    expect(screen.getByText("10/10 集")).toBeInTheDocument();
    expect(screen.getByText("3/8 集")).toBeInTheDocument();
    expect(screen.getByText("12 集")).toBeInTheDocument();

    // 状态徽标已看/在看
    expect(screen.getByText("已看")).toBeInTheDocument();
    expect(screen.getByText("在看")).toBeInTheDocument();

    // 跳转链接匹配
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/series/series-1/seasons/season-1");
    expect(links[1]).toHaveAttribute("href", "/series/series-1/seasons/season-2");
    expect(links[2]).toHaveAttribute("href", "/series/series-1/seasons/season-3");
  });
});

