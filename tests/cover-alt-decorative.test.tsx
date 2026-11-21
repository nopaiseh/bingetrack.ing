import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MediaRow from "@/components/MediaRow";
import { SearchMediaCard } from "@/components/SearchMediaCard";
import AlbumCoverCard from "@/components/AlbumCoverCard";
import ContinueWatchingRail, { type ContinueWatchingCard } from "@/components/ContinueWatchingRail";
import CurrentlyReadingRail from "@/components/CurrentlyReadingRail";
import ContinueListeningRail, { type ContinueListeningCard } from "@/components/ContinueListeningRail";
import LetterTile from "@/components/LetterTile";
import type { MediaCard } from "@/lib/types";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

function movie(overrides: Partial<MediaCard> = {}): MediaCard {
  return {
    id: "m1",
    title: "星光档案",
    date: "2024-01-01",
    release_year: "2024",
    rating: null,
    genres: [],
    languages: [],
    cover_url: "https://image.tmdb.org/t/p/w342/poster.jpg",
    type: "movies",
    dbType: "movie",
    status: undefined,
    ...overrides,
  };
}

function watchingCard(overrides: Partial<ContinueWatchingCard> = {}): ContinueWatchingCard {
  return {
    showId: "show-1",
    title: "跑男",
    posterPath: "/abc.jpg",
    href: "/shows/show-1",
    nextEpisode: {
      seasonNumber: 2,
      episodeNumber: 5,
      title: "集名",
      href: "/shows/show-1/seasons/season-2",
    },
    seasonProgress: { seasonNumber: 2, watched: 33, total: 51 },
    ...overrides,
  };
}

/** 找到链接并断言无障碍名称含标题且只出现一次（封面 alt 不再重复）。 */
function linkWithTitleOnce(title: string) {
  return screen.getByRole("link", {
    name: (accessibleName) => {
      if (!accessibleName.includes(title)) return false;
      expect(accessibleName.indexOf(title)).toBe(accessibleName.lastIndexOf(title));
      return true;
    },
  });
}

describe("封面替代文字与可见标题不重复", () => {
  it("MediaRow：有封面时 img alt 为空，链接无障碍名称含标题一次", () => {
    render(<MediaRow title="我已看" items={[movie()]} type="movie" hideStatusBadge />);
    const link = linkWithTitleOnce("星光档案");
    const img = within(link).getByRole("presentation");
    expect(img).toHaveAttribute("alt", "");
  });

  it("MediaRow：无封面字块 aria-hidden，链接名称仍是标题一次", () => {
    render(
      <MediaRow
        title="我想读"
        items={[movie({ cover_url: "", type: "books", dbType: "book", title: "未命名书" })]}
        type="book"
      />,
    );
    const link = linkWithTitleOnce("未命名书");
    expect(link.querySelector(".letter-tile")).toHaveAttribute("aria-hidden", "true");
  });

  it("MediaRow：电影无封面也用首字块，不出现图片图标", () => {
    render(
      <MediaRow title="我想看" items={[movie({ cover_url: "", title: "缺海报电影" })]} type="movie" hideStatusBadge />,
    );
    const link = linkWithTitleOnce("缺海报电影");
    const tile = link.querySelector(".letter-tile");
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(tile).toHaveAttribute("data-initial", "缺");
    expect(link.querySelector(".i-material-symbols-image-outline-rounded")).toBeNull();
  });

  it("SearchMediaCard：封面装饰性，链接名称含标题一次", () => {
    render(<SearchMediaCard item={movie({ title: "搜索影片" })} returnHref="/search" />);
    const link = linkWithTitleOnce("搜索影片");
    expect(within(link).getByRole("presentation")).toHaveAttribute("alt", "");
  });

  it("AlbumCoverCard：封面装饰性，链接无障碍名称等于标题加艺人", () => {
    render(
      <AlbumCoverCard
        item={movie({
          id: "a1",
          title: "叶惠美",
          type: "albums",
          cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music/cover.jpg",
          artists: ["周杰伦"],
        })}
      />,
    );
    const link = screen.getByRole("link", { name: "叶惠美，周杰伦" });
    expect(within(link).getByRole("presentation")).toHaveAttribute("alt", "");
    expect(link).toHaveAccessibleName("叶惠美，周杰伦");
  });

  it("ContinueWatchingRail：海报 alt 为空，字块装饰性", () => {
    const { unmount } = render(<ContinueWatchingRail items={[watchingCard()]} />);
    const link = linkWithTitleOnce("跑男");
    expect(within(link).getByRole("presentation")).toHaveAttribute("alt", "");
    unmount();

    render(<ContinueWatchingRail items={[watchingCard({ posterPath: null, title: "航海王" })]} />);
    const fallbackLink = linkWithTitleOnce("航海王");
    expect(fallbackLink.querySelector(".letter-tile")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img", { name: "航海王" })).not.toBeInTheDocument();
  });

  it("CurrentlyReadingRail / ContinueListeningRail：封面装饰性", () => {
    render(
      <CurrentlyReadingRail
        items={[
          {
            bookId: "b1",
            title: "在读的书",
            posterPath: "/book.jpg",
            href: "/books/b1",
            authors: ["作者"],
          },
        ]}
      />,
    );
    expect(within(linkWithTitleOnce("在读的书")).getByRole("presentation")).toHaveAttribute("alt", "");

    render(
      <ContinueListeningRail
        items={[
          {
            albumId: "album-1",
            title: "在听专辑",
            posterPath: "/album.jpg",
            href: "/albums/album-1",
            trackProgress: { watched: 2, total: 10 },
          } satisfies ContinueListeningCard,
        ]}
      />,
    );
    expect(within(linkWithTitleOnce("在听专辑")).getByRole("presentation")).toHaveAttribute("alt", "");
  });

  it("LetterTile：decorative 默认隐藏；standalone 提供有意义名称", () => {
    const { rerender } = render(<LetterTile title="单独封面" />);
    expect(document.querySelector(".letter-tile")).toHaveAttribute("aria-hidden", "true");

    rerender(<LetterTile title="单独封面" decorative={false} />);
    expect(screen.getByRole("img", { name: "单独封面" })).not.toHaveAttribute("aria-hidden");
  });
});
