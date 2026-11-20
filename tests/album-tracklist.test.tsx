import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AlbumTracklist from "@/components/AlbumTracklist";
import type { AlbumTrack } from "@/lib/types/album";

const track: AlbumTrack = {
  id: "t1",
  trackNumber: 1,
  title: "第一首",
  singers: ["歌手 A", "歌手 B"],
  lyricists: ["词人"],
  composers: ["曲作者"],
  durationSeconds: 205,
  status: "watched",
  rating: 9,
};

describe("AlbumTracklist", () => {
  it("renders track columns and listening labels", () => {
    render(<AlbumTracklist tracks={[track]} />);
    expect(screen.getByRole("table", { name: "曲目列表" })).toBeInTheDocument();
    expect(screen.getByText("第一首")).toBeInTheDocument();
    expect(screen.getAllByText("歌手 A、歌手 B").length).toBeGreaterThan(0);
    expect(screen.getByText("词人")).toBeInTheDocument();
    expect(screen.getByText("曲作者")).toBeInTheDocument();
    expect(screen.getByText("3:25")).toBeInTheDocument();
    expect(screen.getByText("听过")).toBeInTheDocument();
  });

  it("shows empty copy when there are no tracks", () => {
    render(<AlbumTracklist tracks={[]} />);
    expect(screen.getByText("这张专辑还没有曲目。")).toBeInTheDocument();
  });
});
