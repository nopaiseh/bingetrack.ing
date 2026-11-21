import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AlbumDetailHeader from "@/components/AlbumDetailHeader";
import type { Media } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

function media(overrides: Partial<Media> = {}): Media {
  return {
    id: "album-1",
    title: "范特西",
    alternate_title: "Fantasy",
    date: "2001-09-14",
    release_year: "2001",
    rating: 9.2,
    genres: [],
    languages: [],
    cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music/fantasy.jpg",
    type: "albums",
    status: "watched",
    ...overrides,
  };
}

describe("AlbumDetailHeader", () => {
  it("渲染标题、副标题、元信息行与默认返回专辑列表链接", () => {
    render(
      <AlbumDetailHeader
        media={media()}
        artists={["周杰伦"]}
        trackCount={10}
        label="阿尔发音乐"
        ratedCount={3}
        ownership="owned"
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "范特西" })).toBeInTheDocument();
    expect(screen.getByText("Fantasy")).toBeInTheDocument();
    expect(screen.getByText("周杰伦")).toBeInTheDocument();
    expect(screen.getByText("2001")).toBeInTheDocument();
    expect(screen.getByText("阿尔发音乐")).toBeInTheDocument();
    expect(screen.getByText("10 首")).toBeInTheDocument();
    expect(screen.getByText("9.2")).toBeInTheDocument();
    expect(screen.getByText("神作")).toBeInTheDocument();
    expect(screen.getByText("（3 首已评）")).toBeInTheDocument();
    expect(screen.getByText("已拥有")).toBeInTheDocument();
    expect(screen.getByText("听过")).toBeInTheDocument();

    const back = screen.getByRole("link", { name: /返回音乐列表/ });
    expect(back).toHaveAttribute("href", "/albums");
  });

  it("无封面时用装饰性首字块，不渲染海报图片", () => {
    const { container } = render(
      <AlbumDetailHeader
        media={media({ cover_url: "", title: "八度空间" })}
        artists={["周杰伦"]}
        trackCount={null}
        label={null}
        ratedCount={0}
        ownership={null}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "八度空间" })).toBeInTheDocument();
    const poster = container.querySelector("[data-poster]");
    const tile = poster?.querySelector(".letter-tile");
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(tile).toHaveAttribute("data-initial", "八");
    expect(poster?.querySelector("img")).toBeNull();
  });

  it("副标题与主标题相同时不重复展示，无评分时省略分数行", () => {
    render(
      <AlbumDetailHeader
        media={media({ alternate_title: "范特西", rating: null, status: undefined })}
        artists={[]}
        trackCount={null}
        label={null}
        ratedCount={0}
        ownership="want_to_own"
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "范特西" })).toBeInTheDocument();
    expect(screen.queryByText("Fantasy")).not.toBeInTheDocument();
    expect(screen.queryByText("9.2")).not.toBeInTheDocument();
    expect(screen.getByText("想拥有")).toBeInTheDocument();
  });
});
