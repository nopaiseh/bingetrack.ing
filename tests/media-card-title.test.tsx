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
    expect(title.className).not.toContain("truncate");
  }
  expect(screen.getByText("综艺")).toBeInTheDocument();
});

test("MediaRow 卡片、查看全部与翻页按钮可聚焦且链接正确", () => {
  render(<MediaRow title="我已看" items={series} type="shows" viewAllLink="/shows" />);

  // 无障碍底线：键盘焦点框（toHaveFocus 只证明能聚焦，不能证明 focus-ring 还在）
  for (const link of screen.getAllByRole("link")) {
    expect(link).toHaveClass("focus-ring");
  }
  expect(screen.getByRole("button", { name: "向左滚动 我已看", hidden: true })).toHaveClass("focus-ring");
  expect(screen.getByRole("button", { name: "向右滚动 我已看", hidden: true })).toHaveClass("focus-ring");

  const viewAll = screen.getByRole("link", { name: /查看全部/ });
  expect(viewAll).toHaveAttribute("href", "/shows");
  viewAll.focus();
  expect(viewAll).toHaveFocus();

  const card = screen.getByRole("link", { name: /体能之巅：百人大挑战 意大利/ });
  expect(card).toHaveAttribute("href", "/shows/it");
  card.focus();
  expect(card).toHaveFocus();
});

test("MediaRow 横向滚动在 reduced-motion 下不强制 scroll-smooth", () => {
  const { container } = render(<MediaRow title="我已看" items={series} type="shows" />);

  const scroller = container.querySelector(".motion-safe\\:scroll-smooth");
  expect(scroller).not.toBeNull();
  expect(scroller?.className).not.toMatch(/(?:^|\s)scroll-smooth(?:\s|$)/);
});

test("search cards link to detail with from, show title body and letter-tile fallback", () => {
  render(<SearchMediaCard item={series[0]} returnHref="/search?type=tv_show" />);

  const link = screen.getByRole("link", { name: /体能之巅：百人大挑战 意大利/ });
  expect(link).toHaveAttribute("href", "/shows/it?from=%2Fsearch%3Ftype%3Dtv_show");
  // 无障碍底线：搜索卡链接保留焦点框
  expect(link).toHaveClass("focus-ring");
  link.focus();
  expect(link).toHaveFocus();

  const tile = link.querySelector(".letter-tile");
  expect(tile).toHaveAttribute("aria-hidden", "true");
  expect(tile).toHaveAttribute("data-initial", "体");
  expect(link.querySelector("img")).toBeNull();

  expect(screen.getByRole("heading", { level: 2, name: "体能之巅：百人大挑战 意大利" })).toBeInTheDocument();
  expect(screen.getByTestId("media-card-status-badge")).toHaveTextContent("已看");
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

test("shared badges and filter chips expose rating tier, status, and search tag link", () => {
  render(
    <>
      <MediaRatingBadge rating={8.2} size="sm" />
      <MediaRatingBadge rating={null} size="sm" />
      <MediaCardStatusBadge status="watched" />
      <SearchTag label="科幻" category="genre" />
    </>,
  );

  expect(screen.getByText("佳作")).toBeInTheDocument();
  expect(screen.getByText("未评分")).toBeInTheDocument();
  expect(screen.getByTestId("media-card-status-badge")).toHaveTextContent("已看");
  const tag = screen.getByRole("link", { name: "科幻" });
  expect(tag).toHaveAttribute("href", "/search?genre=%E7%A7%91%E5%B9%BB");

  // 无障碍底线：徽章最小字号 text-xs（禁止缩到 text-[10px]）
  expect(screen.getByText("佳作").className).toContain("text-xs");
  expect(screen.getByText("佳作").className).not.toContain("text-[10px]");
  expect(screen.getByText("未评分").className).toContain("text-xs");
  expect(screen.getByTestId("media-card-status-badge").className).toContain("text-xs");
  expect(screen.getByTestId("media-card-status-badge").className).not.toContain("text-[10px]");
  // 无障碍底线：筛选标签触控目标至少 40px（min-h-10）
  expect(tag.className).toContain("min-h-10");
});
