import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import MediaRow from "@/components/MediaRow";
import { SearchMediaCard } from "@/components/SearchMediaCard";
import MediaRatingBadge from "@/components/MediaRatingBadge";
import MediaCardStatusBadge from "@/components/MediaCardStatusBadge";
import SearchTag from "@/components/SearchTag";
import type { MediaCard } from "@/lib/types";

const series: MediaCard[] = [
  { id: "it", title: "体能之巅：百人大挑战 意大利", date: "2026-01-01", release_year: "2026", rating: 8.3, genres: ["竞技", "综艺"], languages: ["意大利语"], cover_url: "", type: "shows", status: "watched" },
  { id: "mx", title: "体能之巅：百人大挑战 墨西哥", date: "2026-01-01", release_year: "2026", rating: 8.2, genres: ["竞技"], languages: ["西班牙语"], cover_url: "", type: "shows", status: "watched" },
];

test("series cards keep two lines of title instead of a single truncated line", () => {
  render(<MediaRow title="我已看" items={series} type="shows" />);

  const titles = screen.getAllByRole("heading", { level: 3 });
  expect(titles.map((title) => title.textContent)).toEqual([
    "体能之巅：百人大挑战 意大利",
    "体能之巅：百人大挑战 墨西哥",
  ]);
  for (const title of titles) {
    expect(title.className).toContain("line-clamp-2");
    expect(title.className).toContain("min-h-10");
    expect(title.className).not.toContain("truncate");
  }
  expect(screen.getByText("综艺").className).toContain("text-xs");
  expect(screen.getByText("综艺").className).not.toContain("text-[10px]");
});

test("search cards use the same two-line title", () => {
  render(<SearchMediaCard item={series[0]} returnHref="/search?type=tv_show" />);

  const title = screen.getByRole("heading", { level: 3 });
  expect(title.className).toContain("line-clamp-2");
  expect(title.className).not.toContain("truncate");
});

test("shared badges and filter chips stay at least 14px with a 40px chip target", () => {
  render(
    <>
      <MediaRatingBadge rating={8.2} size="sm" />
      <MediaRatingBadge rating={null} size="sm" />
      <MediaCardStatusBadge status="watched" />
      <SearchTag label="科幻" category="genre" />
    </>,
  );

  expect(screen.getByText("佳作").className).toContain("text-xs");
  expect(screen.getByText("佳作").className).not.toContain("text-[10px]");
  expect(screen.getByText("未评分").className).toContain("text-xs");
  expect(screen.getByTestId("media-card-status-badge").className).toContain("text-xs");
  expect(screen.getByTestId("media-card-status-badge").className).not.toContain("text-[10px]");
  expect(screen.getByRole("link", { name: "科幻" }).className).toContain("min-h-10");
});
