import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import MediaRow from "@/components/MediaRow";
import { SearchMediaCard } from "@/components/SearchMediaCard";
import MediaRatingBadge from "@/components/MediaRatingBadge";
import MediaCardStatusBadge from "@/components/MediaCardStatusBadge";
import SearchTag from "@/components/SearchTag";
import type { MediaCard } from "@/lib/types";

const series: MediaCard[] = [
  {
    id: "it",
    title: "体能之巅：百人大挑战 意大利",
    date: "2026-01-01",
    release_year: "2026",
    rating: 8.3,
    genres: ["竞技", "综艺"],
    languages: ["意大利语"],
    cover_url: "",
    type: "shows",
    status: "watched",
  },
  {
    id: "mx",
    title: "体能之巅：百人大挑战 墨西哥",
    date: "2026-01-01",
    release_year: "2026",
    rating: 8.2,
    genres: ["竞技"],
    languages: ["西班牙语"],
    cover_url: "",
    type: "shows",
    status: "watched",
  },
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

test("search cards reuse the catalog card surface, poster badge, and body", () => {
  render(<SearchMediaCard item={series[0]} returnHref="/search?type=tv_show" />);

  const link = screen.getByRole("link", { name: /体能之巅：百人大挑战 意大利/ });
  expect(link.className).toContain("surface-card");
  expect(link.className).toContain("interactive-media-card");
  expect(link.className).toContain("overflow-hidden");
  expect(link.className).toContain("rounded-xl");
  expect(link.className).toContain("focus-visible:outline-2");
  expect(link).toHaveAttribute("href", "/shows/it?from=%2Fsearch%3Ftype%3Dtv_show");
  link.focus();
  expect(link).toHaveFocus();

  const poster = link.querySelector(".image-placeholder");
  expect(poster).not.toBeNull();
  expect(poster?.querySelector("img")).toBeNull();
  expect(poster?.querySelector(".i-material-symbols-image-outline-rounded")).not.toBeNull();

  const badge = screen.getByTestId("media-card-status-badge");
  expect(badge.className).toContain("absolute");
  expect(badge.className).toContain("top-2");
  expect(badge.className).toContain("right-2");
  expect(badge.className).not.toContain("bg-transparent");

  const title = screen.getByRole("heading", { level: 3 });
  expect(title.className).toContain("line-clamp-2");
  expect(title.className).toContain("min-h-10");
  expect(title.className).not.toContain("truncate");
  expect(screen.getByText("佳作")).toBeInTheDocument();
  expect(screen.getByText("竞技")).toBeInTheDocument();
  expect(screen.getByText("综艺")).toBeInTheDocument();
  expect(screen.getByText("意大利语")).toBeInTheDocument();
});

test("search cards show 即将上映 on the poster only when unwatched and dated ahead", () => {
  const future = {
    ...series[0],
    id: "future",
    title: "尚未定档",
    date: "2099-06-01",
    status: "want_to_watch",
  };
  const { unmount } = render(<SearchMediaCard item={future} returnHref="/search" />);
  const upcoming = screen.getByTestId("media-card-upcoming-badge");
  expect(upcoming).toHaveTextContent("即将上映");
  expect(upcoming).toHaveAttribute("aria-label", "即将上映");
  expect(upcoming.className).toContain("absolute");
  expect(upcoming.className).toContain("top-2");
  expect(upcoming.className).toContain("right-2");
  expect(upcoming.className).toContain("rounded-full");
  expect(screen.queryByTestId("media-card-status-badge")).not.toBeInTheDocument();
  unmount();

  const past = render(
    <SearchMediaCard item={{ ...future, id: "past", title: "已经上映", date: "2000-01-01" }} returnHref="/search" />,
  );
  expect(screen.queryByTestId("media-card-upcoming-badge")).not.toBeInTheDocument();
  expect(screen.getByTestId("media-card-status-badge")).toHaveTextContent("想看");
  expect(screen.getByTestId("media-card-status-badge")).toHaveAttribute("aria-label", "观看状态：想看");
  past.unmount();

  render(
    <SearchMediaCard item={{ ...future, id: "seen", title: "已看的新片", status: "watched" }} returnHref="/search" />,
  );
  expect(screen.queryByTestId("media-card-upcoming-badge")).not.toBeInTheDocument();
  expect(screen.getByTestId("media-card-status-badge")).toHaveTextContent("已看");
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
