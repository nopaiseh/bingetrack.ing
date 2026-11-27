import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SongDetail } from "@/lib/types/song";

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
  getCachedSongDetail: vi.fn(),
}));

import SongDetailPage from "@/app/music/[id]/page";
import { getCachedSongDetail } from "@/lib/functions/cached-media";

const songId = "50000000-0000-4000-8000-000000000021";
const personId = "40000000-0000-4000-8000-000000000004";
const albumId = "50000000-0000-4000-8000-000000000020";

function songDetail(overrides: Partial<SongDetail> = {}): SongDetail {
  return {
    id: songId,
    title: "夜航序曲",
    alternate_title: "Night Overture",
    duration_seconds: 210,
    release_date: "2024-05-20",
    summary: "不应展示",
    cover_url: null,
    genres: [],
    languages: [],
    series: [],
    credits: {
      artist: [{ id: personId, name: "测试艺人", alternate_name: null }],
      lyricist: [{ id: "40000000-0000-4000-8000-000000000005", name: "测试词人", alternate_name: null }],
    },
    albums: [
      {
        id: albumId,
        title: "测试专辑：夜航电台",
        cover_url: null,
        release_date: "2024-05-20",
        release_kind: "album",
        disc_number: 1,
        track_number: 1,
        other_tracks: [
          {
            id: "50000000-0000-4000-8000-000000000022",
            title: "回港信号",
            disc_number: 1,
            track_number: 2,
            duration_seconds: 185,
          },
        ],
      },
    ],
    related: [
      {
        id: "50000000-0000-4000-8000-000000000024",
        title: "独立航标",
        cover_url: null,
        release_date: "2024-07-01",
        relations: ["artist", "lyricist"],
      },
    ],
    tracking: { status: "watched", rating: 8.5 },
    ...overrides,
  };
}

describe("歌曲详情页", () => {
  beforeEach(() => {
    vi.mocked(getCachedSongDetail).mockReset();
  });

  it("渲染页头、演职人物链、收录于、同专曲目与相关歌曲关系标签", async () => {
    vi.mocked(getCachedSongDetail).mockResolvedValue(songDetail());
    render(await SongDetailPage({ params: Promise.resolve({ id: songId }) }));

    expect(screen.getByRole("heading", { level: 1, name: "夜航序曲" })).toBeInTheDocument();
    expect(screen.getByText("听过")).toBeInTheDocument();
    expect(screen.queryByText("不应展示")).not.toBeInTheDocument();

    const artist = screen.getByRole("link", { name: "测试艺人" });
    expect(artist).toHaveAttribute("href", `/people/${personId}`);

    expect(screen.getByRole("heading", { level: 2, name: "收录于" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "测试专辑：夜航电台" })).toHaveAttribute(
      "href",
      expect.stringContaining(`/albums/${albumId}`),
    );
    expect(screen.getByRole("heading", { level: 3, name: "同专其他曲目" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "回港信号" })).toHaveAttribute(
      "href",
      expect.stringContaining("/music/50000000-0000-4000-8000-000000000022"),
    );

    expect(screen.getByRole("heading", { level: 2, name: "相关歌曲" })).toBeInTheDocument();
    expect(screen.getByText("演唱・作词")).toBeInTheDocument();
    expect(screen.queryByText("他的其他作品")).not.toBeInTheDocument();
    expect(screen.queryByText(/^他/)).not.toBeInTheDocument();
  });

  it("无记录时 notFound", async () => {
    vi.mocked(getCachedSongDetail).mockResolvedValue(null);
    await expect(SongDetailPage({ params: Promise.resolve({ id: songId }) })).rejects.toThrow("NOT_FOUND");
  });
});
