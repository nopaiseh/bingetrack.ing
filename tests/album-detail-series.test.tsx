import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlbumDetail } from "@/lib/types/album";
import type { MediaCard } from "@/lib/types";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/functions/cached-media", () => ({
  getCachedAlbumDetail: vi.fn(),
}));

import AlbumDetailPage from "@/app/albums/[id]/page";
import { getCachedAlbumDetail } from "@/lib/functions/cached-media";

const albumId = "10000000-0000-4000-8000-000000000001";
const siblingId = "10000000-0000-4000-8000-000000000002";

function albumCard(overrides: Partial<MediaCard> = {}): MediaCard {
  return {
    id: siblingId,
    title: "八度空间",
    date: "2002-07-18",
    release_year: "2002",
    rating: null,
    genres: [],
    languages: [],
    cover_url: "https://image.tmdb.org/t/p/w342/album.jpg",
    type: "albums",
    dbType: "album",
    artists: ["周杰伦"],
    ...overrides,
  };
}

function albumDetail(overrides: Partial<AlbumDetail> = {}): AlbumDetail {
  return {
    media: {
      id: albumId,
      title: "叶惠美",
      type: "albums",
      date: "2003-07-31",
      release_year: "2003",
      rating: null,
      genres: [],
      languages: [],
      cover_url: "",
      series: [],
    },
    artists: ["周杰伦"],
    trackCount: 11,
    label: null,
    ratedCount: 0,
    ownership: null,
    tracks: [],
    series: [],
    ...overrides,
  };
}

describe("专辑详情页系列区块", () => {
  beforeEach(() => {
    vi.mocked(getCachedAlbumDetail).mockReset();
  });

  it("有系列且 items 非空时渲染 MediaRow，标题为《系列名》系列，并显示第N部角标", async () => {
    vi.mocked(getCachedAlbumDetail).mockResolvedValue(
      albumDetail({
        series: [
          {
            name: "杰伦专辑",
            position: 4,
            items: [albumCard({ seriesPosition: 2, title: "八度空间" })],
          },
        ],
      }),
    );

    render(await AlbumDetailPage({ params: Promise.resolve({ id: albumId }) }));

    const section = screen.getByTestId("album-series-section");
    expect(within(section).getByRole("heading", { name: "《杰伦专辑》系列" })).toBeInTheDocument();
    const badge = within(section).getByTestId("media-card-series-position");
    expect(badge).toHaveTextContent("第2部");
    expect(badge).toHaveAttribute("aria-label", "系列第2部");
    expect(screen.getByRole("link", { name: /八度空间/ })).toHaveAttribute("href", `/albums/${siblingId}`);
  });

  it("series 为空或全部 items 为空时不渲染系列区块", async () => {
    vi.mocked(getCachedAlbumDetail).mockResolvedValueOnce(albumDetail({ series: [] }));
    const { rerender } = render(await AlbumDetailPage({ params: Promise.resolve({ id: albumId }) }));
    expect(screen.queryByTestId("album-series-section")).not.toBeInTheDocument();
    expect(screen.queryByText(/系列/)).not.toBeInTheDocument();

    vi.mocked(getCachedAlbumDetail).mockResolvedValueOnce(
      albumDetail({
        series: [{ name: "空系列", position: 1, items: [] }],
      }),
    );
    rerender(await AlbumDetailPage({ params: Promise.resolve({ id: albumId }) }));
    expect(screen.queryByTestId("album-series-section")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "《空系列》系列" })).not.toBeInTheDocument();
  });

  it("缺 seriesPosition 时仍渲染系列行，但不显示角标、不编造序号", async () => {
    vi.mocked(getCachedAlbumDetail).mockResolvedValue(
      albumDetail({
        series: [
          {
            name: "华语经典",
            position: null,
            items: [albumCard({ id: "a", title: "甲", seriesPosition: null }), albumCard({ id: "b", title: "乙" })],
          },
        ],
      }),
    );

    render(await AlbumDetailPage({ params: Promise.resolve({ id: albumId }) }));

    const section = screen.getByTestId("album-series-section");
    expect(within(section).getByRole("heading", { name: "《华语经典》系列" })).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: /甲/ })).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: /乙/ })).toBeInTheDocument();
    expect(screen.queryByTestId("media-card-series-position")).not.toBeInTheDocument();
    expect(screen.queryByText(/第\d+部/)).not.toBeInTheDocument();
  });
});
