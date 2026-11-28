import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonDetail } from "@/lib/types/person";

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
  getCachedPersonDetail: vi.fn(),
}));

import PersonDetailPage from "@/app/people/[id]/page";
import { getCachedPersonDetail } from "@/lib/functions/cached-media";

const personId = "40000000-0000-4000-8000-000000000005";
const songId = "50000000-0000-4000-8000-000000000021";

function lyricistOnly(overrides: Partial<PersonDetail> = {}): PersonDetail {
  return {
    id: personId,
    name: "测试词人",
    alternate_name: "Fixture Lyricist",
    photo_url: null,
    works: {
      person_id: personId,
      film_tv: [],
      music: {
        albums: [],
        songs: [
          {
            role: "lyricist",
            label: "作词",
            items: [
              {
                id: songId,
                type: "music",
                title: "夜航序曲",
                alternate_title: null,
                cover_url: null,
                release_date: "2024-05-20",
              },
            ],
          },
        ],
      },
      books: [],
    },
    ...overrides,
  };
}

describe("人物详情页", () => {
  beforeEach(() => {
    vi.mocked(getCachedPersonDetail).mockReset();
  });

  it("仅有歌曲 credit 时不展示作品区，显示暂无公开作品", async () => {
    vi.mocked(getCachedPersonDetail).mockResolvedValue(lyricistOnly());
    render(await PersonDetailPage({ params: Promise.resolve({ id: personId }) }));

    expect(screen.getByRole("heading", { level: 1, name: "测试词人" })).toBeInTheDocument();
    expect(screen.getByText("暂无公开作品。")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "歌曲" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "影视" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "专辑" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "图书" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /夜航序曲/ })).not.toBeInTheDocument();
  });

  it("专辑作品副标题将 release_kind 译为中文，不露出英文枚举", async () => {
    const albumId = "50000000-0000-4000-8000-000000000020";
    vi.mocked(getCachedPersonDetail).mockResolvedValue(
      lyricistOnly({
        works: {
          person_id: personId,
          film_tv: [],
          music: {
            albums: [
              {
                role: "artist",
                label: "艺人",
                items: [
                  {
                    id: albumId,
                    type: "album",
                    title: "夜航电台",
                    alternate_title: null,
                    cover_url: null,
                    release_date: "2024-05-20",
                    release_kind: "album",
                  },
                ],
              },
            ],
            songs: [],
          },
          books: [],
        },
      }),
    );
    render(await PersonDetailPage({ params: Promise.resolve({ id: personId }) }));

    expect(screen.getByRole("heading", { level: 2, name: "专辑" })).toBeInTheDocument();
    expect(screen.getByText(/专辑 · 2024/)).toBeInTheDocument();
    expect(screen.queryByText(/\balbum\b/)).not.toBeInTheDocument();
  });

  it("无记录时 notFound", async () => {
    vi.mocked(getCachedPersonDetail).mockResolvedValue(null);
    await expect(PersonDetailPage({ params: Promise.resolve({ id: personId }) })).rejects.toThrow("NOT_FOUND");
  });
});
