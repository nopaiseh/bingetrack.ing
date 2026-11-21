import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FilmographyRow from "@/app/(admin)/manage/references/FilmographyRow";
import RelatedWork from "@/app/(admin)/manage/references/RelatedWork";
import { SearchMediaCard } from "@/components/SearchMediaCard";
import MediaRow from "@/components/MediaRow";
import type { RelatedMedia } from "@/lib/admin/credits";
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
    cover_url: "",
    type: "movies",
    status: undefined,
    ...overrides,
  };
}

function related(overrides: Partial<RelatedMedia> = {}): RelatedMedia {
  return {
    id: "r1",
    title: "城市信号",
    alternate_title: null,
    type: "tv_show",
    cover_url: null,
    release_date: "2024-01-01",
    runtime: null,
    ...overrides,
  };
}

describe("无封面统一首字块", () => {
  it("搜索卡电影／电视节目无封面用 letter-tile，不用图片图标", () => {
    const { rerender } = render(<SearchMediaCard item={movie({ title: "缺封面电影" })} returnHref="/search" />);
    let tile = document.querySelector(".letter-tile");
    expect(tile).toHaveAttribute("data-initial", "缺");
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(document.querySelector(".i-material-symbols-image-outline-rounded")).toBeNull();

    rerender(<SearchMediaCard item={movie({ id: "s1", title: "缺封面剧集", type: "shows" })} returnHref="/search" />);
    tile = document.querySelector(".letter-tile");
    expect(tile).toHaveAttribute("data-initial", "缺");
    expect(screen.getByRole("heading", { name: "缺封面剧集" })).toBeInTheDocument();
  });

  it("横向卡片电影／电视节目无封面与图书同一套字块", () => {
    render(
      <MediaRow
        title="精选"
        items={[
          movie({ id: "m", title: "电影甲" }),
          movie({ id: "s", title: "剧集乙", type: "shows" }),
          movie({ id: "b", title: "图书丙", type: "books" }),
        ]}
        hideStatusBadge
      />,
    );
    const tiles = [...document.querySelectorAll(".letter-tile")];
    expect(tiles).toHaveLength(3);
    expect(tiles.map((node) => node.getAttribute("data-initial"))).toEqual(["电", "剧", "图"]);
    expect(tiles.every((node) => node.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("管理端关联作品与作品年表无封面用 letter-tile", () => {
    const { unmount } = render(<RelatedWork media={related({ title: "关联节目" })} />);
    expect(document.querySelector(".letter-tile")).toHaveAttribute("data-initial", "关");
    expect(document.querySelector(".letter-tile")).toHaveAttribute("aria-hidden", "true");
    unmount();

    render(<FilmographyRow media={related({ title: "年表作品" })} showYear />);
    expect(document.querySelector(".letter-tile")).toHaveAttribute("data-initial", "年");
    expect(document.querySelector(".letter-tile")).toHaveAttribute("aria-hidden", "true");
  });
});
