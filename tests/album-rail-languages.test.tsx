import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AlbumRail from "@/app/(admin)/manage/media/album/AlbumRail";
import type { AlbumStructure } from "@/lib/admin/album-structure";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function structure(overrides: Partial<AlbumStructure["tracks"][number]>[] = []): AlbumStructure {
  const tracks = [
    {
      id: "t1",
      number: 1,
      title: "摩天动物园",
      durationSeconds: 252,
      listened: true,
      hasLanguages: true,
      ...overrides[0],
    },
    {
      id: "t2",
      number: 2,
      title: "来自天堂的魔鬼",
      durationSeconds: 245,
      listened: false,
      hasLanguages: false,
      ...overrides[1],
    },
  ];
  return {
    album: {
      id: "album",
      title: "摩天动物园",
      alternateTitle: null,
      coverUrl: null,
      status: "watching",
      rating: 8.2,
      artists: [],
    },
    tracks,
    trackCount: tracks.length,
    nextTrackNumber: tracks.length + 1,
  };
}

describe("AlbumRail language hints", () => {
  it("marks tracks without languages with an accessible warning dot", () => {
    render(<AlbumRail structure={structure()} current={{ type: "album", id: "album" }} onAdd={() => {}} />);

    const rail = screen.getByRole("complementary", { name: "曲目结构" });
    const rows = within(rail).getAllByRole("listitem");
    expect(within(rows[0]).queryByRole("img", { name: "未设语言" })).toBeNull();
    expect(within(rows[1]).getByRole("img", { name: "未设语言" })).toHaveAttribute("title", "未设语言");
  });
});
