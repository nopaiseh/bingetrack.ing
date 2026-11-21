import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AlbumsCatalog from "@/app/albums/AlbumsCatalog";
import type { MediaCard } from "@/lib/types";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

function album(partial: Partial<MediaCard> & Pick<MediaCard, "id" | "title">): MediaCard {
  return {
    date: "2024-01-01",
    release_year: "2024",
    rating: 8.5,
    genres: [],
    languages: [],
    cover_url: "",
    type: "albums",
    dbType: "album",
    status: "watched",
    artists: ["测试艺人"],
    ...partial,
  };
}

describe("AlbumsCatalog", () => {
  const watched = [album({ id: "w1", title: "已听专辑", status: "watched", rating: 9.2 })];
  const watching = [album({ id: "g1", title: "在听专辑", status: "watching", rating: 7.6 })];
  const want = [album({ id: "t1", title: "想听专辑", status: "want_to_watch", rating: null })];

  it("渲染五项统计与三个收听分区", () => {
    render(
      <AlbumsCatalog
        watched={watched}
        watching={watching}
        want={want}
        stats={{ total: 3, watched: 1, watching: 1, want: 1, trackTotal: 12 }}
      />,
    );

    expect(screen.getByRole("heading", { name: "专辑", hidden: true })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "我已听" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "我在听" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "我想听" })).toBeInTheDocument();
    expect(screen.getByText("已听专辑")).toBeInTheDocument();
    expect(screen.getByText("在听专辑")).toBeInTheDocument();
    expect(screen.getByText("想听专辑")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "专辑封面墙" })).not.toBeInTheDocument();

    expect(screen.getAllByRole("link", { name: /查看全部/ }).map((link) => link.getAttribute("href"))).toEqual([
      "/search?type=album&status=watched",
      "/search?type=album&status=watching",
      "/search?type=album&status=want_to_watch",
    ]);
  });

  it("空分区隐藏，空目录显示空状态", () => {
    const { rerender, container } = render(
      <AlbumsCatalog
        watched={watched}
        watching={[]}
        want={[]}
        stats={{ total: 1, watched: 1, watching: 0, want: 0, trackTotal: 4 }}
      />,
    );

    expect(screen.getByRole("heading", { name: "我已听" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "我在听" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "我想听" })).not.toBeInTheDocument();
    expect(container.querySelector("[class*='aspect-square']")).toBeTruthy();

    rerender(
      <AlbumsCatalog
        watched={[]}
        watching={[]}
        want={[]}
        stats={{ total: 0, watched: 0, watching: 0, want: 0, trackTotal: 0 }}
      />,
    );
    expect(screen.getByText("还没有专辑。")).toBeInTheDocument();
  });
});
