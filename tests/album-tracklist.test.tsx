import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AlbumTracklist, { sortedTrackGenres } from "@/components/AlbumTracklist";
import type { AlbumTrack } from "@/lib/types/album";

const track: AlbumTrack = {
  id: "t1",
  trackNumber: 1,
  title: "第一首",
  singers: ["歌手 A", "歌手 B"],
  lyricists: ["词人"],
  composers: ["曲作者"],
  genres: ["流行"],
  durationSeconds: 205,
  status: "watched",
  rating: 9,
};

describe("sortedTrackGenres", () => {
  it("按名称排序", () => {
    expect(sortedTrackGenres(["独立流行", "城市民谣"])).toEqual(
      [...["独立流行", "城市民谣"]].sort((a, b) => a.localeCompare(b, "zh")),
    );
  });
});

describe("AlbumTracklist", () => {
  it("renders track columns, genre column, and listening labels", () => {
    render(<AlbumTracklist tracks={[track]} />);
    const table = screen.getByRole("table", { name: "曲目列表" });
    expect(table).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "类型" })).toBeInTheDocument();
    expect(screen.getByText("第一首")).toBeInTheDocument();
    expect(screen.getAllByText("流行").length).toBeGreaterThan(0);
    expect(screen.getAllByText("歌手 A、歌手 B").length).toBeGreaterThan(0);
    expect(screen.getByText("词人")).toBeInTheDocument();
    expect(screen.getByText("曲作者")).toBeInTheDocument();
    expect(screen.getByText("3:25")).toBeInTheDocument();
    expect(screen.getByText("听过")).toBeInTheDocument();
  });

  it("shows muted dash for empty genres on desktop column", () => {
    render(
      <AlbumTracklist
        tracks={[
          {
            ...track,
            id: "t2",
            title: "无类型",
            genres: [],
          },
        ]}
      />,
    );
    const table = screen.getByRole("table", { name: "曲目列表" });
    expect(within(table).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows empty copy when there are no tracks", () => {
    render(<AlbumTracklist tracks={[]} />);
    expect(screen.getByText("这张专辑还没有曲目。")).toBeInTheDocument();
  });
});
