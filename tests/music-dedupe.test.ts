import { describe, expect, it, vi } from "vitest";
import {
  findMusicDuplicateId,
  isDuplicateMusicEntry,
  normalizeArtistNames,
  normalizeMediaTitle,
  sameArtistSet,
} from "@/lib/music/dedupe";

describe("music dedupe helpers", () => {
  it("normalizes titles by trimming, folding whitespace, and lowercasing", () => {
    expect(normalizeMediaTitle("  Hello   World ")).toBe("hello world");
    expect(normalizeMediaTitle(null)).toBe("");
  });

  it("treats artist sets as order-insensitive after normalization", () => {
    expect(normalizeArtistNames(["B", " a ", "B"])).toEqual(["a", "b"]);
    expect(sameArtistSet(["A", "B"], ["b", "a"])).toBe(true);
    expect(sameArtistSet(["A"], ["A", "B"])).toBe(false);
  });

  it("detects duplicate entries by title and artists", () => {
    expect(
      isDuplicateMusicEntry({
        title: " Song ",
        artists: ["Artist One"],
        existingTitle: "song",
        existingArtists: ["artist one"],
      }),
    ).toBe(true);
    expect(
      isDuplicateMusicEntry({
        title: "Song",
        artists: ["Artist One"],
        existingTitle: "Song",
        existingArtists: ["Other"],
      }),
    ).toBe(false);
  });

  it("calls the database dedupe RPC and returns the id", async () => {
    const rpc = vi.fn(async () => ({ data: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", error: null }));
    await expect(findMusicDuplicateId({ rpc }, { type: "album", title: "Album", artists: ["A"] })).resolves.toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(rpc).toHaveBeenCalledWith("find_music_by_title_and_artists", {
      p_type: "album",
      p_title: "Album",
      p_artist_names: ["A"],
    });
  });

  it("returns null when the RPC finds nothing and throws on error", async () => {
    await expect(
      findMusicDuplicateId({ rpc: async () => ({ data: null, error: null }) }, { type: "music", title: "x" }),
    ).resolves.toBeNull();
    await expect(
      findMusicDuplicateId(
        { rpc: async () => ({ data: null, error: { message: "boom" } }) },
        { type: "music", title: "x" },
      ),
    ).rejects.toThrow("boom");
  });
});
