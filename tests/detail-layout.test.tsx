import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ClampedCopy from "@/components/ClampedCopy";
import MediaInformation from "@/components/MediaInformation";
import type { Media } from "@/lib/types";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

const media: Media = {
  id: "test",
  title: "完美音调",
  date: "2012-09-28",
  rating: 7.4,
  genres: ["喜剧"],
  languages: ["英语"],
  regions: ["美国"],
  cover_url: "https://image.tmdb.org/t/p/w500/poster.jpg",
  type: "movies",
  runtime: 112,
  summary: "一段很长的剧情简介。".repeat(12),
};

describe("详情页窄屏布局", () => {
  it("海报缩到标题旁，简介限制在约 70ch，过长时可展开", () => {
    const { container } = render(<MediaInformation media={media} seasons={null} releaseDateLabel="2012-09-28" />);
    const poster = container.querySelector("[data-poster]");
    expect(poster?.parentElement).toHaveClass("row-span-2", "lg:row-span-3");
    const copy = screen.getByText(/一段很长的剧情简介/);
    expect(copy).toHaveClass("max-w-[70ch]");
    expect(copy.closest("details")).toBeInTheDocument();
    expect(screen.getByText("展开简介 ▾")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "完美音调" })).toHaveClass("text-2xl", "lg:text-5xl");
  });

  it("短简介不提供展开控件", () => {
    render(<ClampedCopy text="暂无简介。" />);
    expect(screen.getByText("暂无简介。")).toHaveClass("max-w-[70ch]");
    expect(screen.queryByText("展开简介 ▾")).not.toBeInTheDocument();
  });
});
