import { describe, expect, it } from "vitest";
import {
  albumReleaseKindLabel,
  formatTrackDuration,
  ownershipLabel,
  resolveAlbumTrackCount,
} from "@/lib/album-display";
import { listenStatusLabel } from "@/lib/listen-status";

describe("album display helpers", () => {
  it("formats track duration as m:ss from seconds", () => {
    expect(formatTrackDuration(65)).toBe("1:05");
    expect(formatTrackDuration(9)).toBe("0:09");
    expect(formatTrackDuration(null)).toBeNull();
    expect(formatTrackDuration(0)).toBeNull();
  });

  it("labels ownership and listening status", () => {
    expect(ownershipLabel("owned")).toBe("已拥有");
    expect(ownershipLabel("want_to_own")).toBe("想拥有");
    expect(ownershipLabel(null)).toBeNull();
    expect(listenStatusLabel("watched")).toBe("听过");
    expect(listenStatusLabel("want_to_watch")).toBe("想听");
    expect(listenStatusLabel("watching")).toBe("在听");
    expect(listenStatusLabel(null)).toBeNull();
  });

  it("maps album_release_kind to Chinese／惯用标签", () => {
    expect(albumReleaseKindLabel("album")).toBe("专辑");
    expect(albumReleaseKindLabel("ep")).toBe("EP");
    expect(albumReleaseKindLabel("single")).toBe("单曲");
    expect(albumReleaseKindLabel("compilation")).toBe("精选集");
    expect(albumReleaseKindLabel(null)).toBeNull();
    expect(albumReleaseKindLabel("unknown")).toBeNull();
  });

  it("resolves album track count from actual tracks first", () => {
    // 有曲目且 track_count 不一致：以实际曲目数为准
    expect(resolveAlbumTrackCount(3, 12)).toBe(3);
    expect(resolveAlbumTrackCount(5, null)).toBe(5);
    // 无曲目有 track_count：回退到手填／已知总数
    expect(resolveAlbumTrackCount(0, 12)).toBe(12);
    expect(resolveAlbumTrackCount(0, 0)).toBe(0);
    // 都没有
    expect(resolveAlbumTrackCount(0, null)).toBeNull();
    expect(resolveAlbumTrackCount(0, undefined)).toBeNull();
  });
});
