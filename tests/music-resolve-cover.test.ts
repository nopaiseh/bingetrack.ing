import { describe, expect, it, vi } from "vitest";
import { artistMatches, normalizeMusicMatchKey, titlesMatch } from "@/lib/music/normalize-match";
import { pickItunesArtwork, resolveMusicCover, upscaleItunesArtworkUrl } from "@/lib/music/resolve-cover";

/** 用 URL 主机名精确匹配，避免子串误伤（CodeQL）。 */
function hostnameOf(input: RequestInfo | URL): string {
  return new URL(String(input)).hostname;
}

function itunesUrl(input: RequestInfo | URL): URL {
  return new URL(String(input));
}

describe("upscaleItunesArtworkUrl", () => {
  it("replaces the bb size segment with 600x600", () => {
    expect(
      upscaleItunesArtworkUrl("https://is1-ssl.mzstatic.com/image/thumb/Music/x/y/z/cover.jpg/100x100bb.jpg"),
    ).toBe("https://is1-ssl.mzstatic.com/image/thumb/Music/x/y/z/cover.jpg/600x600bb.jpg");
  });
});

describe("normalizeMusicMatchKey / titlesMatch / artistMatches", () => {
  it("unifies simplified and traditional Chinese", () => {
    expect(normalizeMusicMatchKey("周杰伦")).toBe(normalizeMusicMatchKey("周杰倫"));
    expect(normalizeMusicMatchKey("周杰伦")).toBe(normalizeMusicMatchKey("周傑倫"));
    expect(titlesMatch("星晴", "星晴")).toBe(true);
  });

  it("strips Live / Single / feat. suffixes for comparison", () => {
    expect(titlesMatch("星晴", "星晴 (Live)")).toBe(true);
    expect(titlesMatch("七里香", "七里香 - Single")).toBe(true);
    expect(titlesMatch("晴天", "晴天 feat. 某人")).toBe(true);
  });

  it("matches artists with & collaborators", () => {
    expect(artistMatches("周杰伦", "周杰倫 & 温岚")).toBe(true);
    expect(artistMatches("周杰伦 & 温岚", "周杰倫")).toBe(true);
    expect(artistMatches("周杰伦", "那英")).toBe(false);
  });
});

describe("pickItunesArtwork", () => {
  it("does not fall back to the first result when titles do not match", () => {
    const art = pickItunesArtwork(
      [
        {
          trackName: "童丽精选",
          artistName: "童丽",
          artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/wrong/100x100bb.jpg",
        },
        {
          trackName: "那英精选",
          artistName: "那英",
          artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/also-wrong/100x100bb.jpg",
        },
      ],
      { title: "星晴", artist: "周杰伦", entity: "song" },
    );
    expect(art).toBeNull();
  });

  it("rejects when the artist does not match", () => {
    const art = pickItunesArtwork(
      [
        {
          trackName: "星晴",
          artistName: "那英",
          artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/a/100x100bb.jpg",
        },
      ],
      { title: "星晴", artist: "周杰伦", entity: "song" },
    );
    expect(art).toBeNull();
  });
});

describe("resolveMusicCover", () => {
  it("prefers iTunes artwork and does not call MusicBrainz when iTunes succeeds", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const host = hostnameOf(input);
      if (host === "itunes.apple.com") {
        expect(itunesUrl(input).searchParams.get("country")).toBe("us");
        return new Response(
          JSON.stringify({
            results: [
              {
                collectionName: "Test Album",
                artistName: "Someone",
                artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/a/b/c/cover.jpg/100x100bb.jpg",
              },
            ],
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch ${String(input)}`);
    });

    await expect(
      resolveMusicCover({ title: "Test Album", artist: "Someone", entity: "album" }, { fetch: fetchImpl }),
    ).resolves.toBe("https://is1-ssl.mzstatic.com/image/thumb/Music/a/b/c/cover.jpg/600x600bb.jpg");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("falls through US mismatches to Taiwan traditional hit", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const host = hostnameOf(input);
      if (host !== "itunes.apple.com") throw new Error(`unexpected fetch ${String(input)}`);
      const country = itunesUrl(input).searchParams.get("country");
      if (country === "us") {
        return new Response(
          JSON.stringify({
            results: [
              {
                trackName: "童丽的歌",
                artistName: "童丽",
                artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/us/100x100bb.jpg",
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (country === "tw") {
        return new Response(
          JSON.stringify({
            results: [
              {
                trackName: "星晴",
                artistName: "周杰倫",
                artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/tw/xingqing/100x100bb.jpg",
              },
            ],
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected country ${country}`);
    });

    await expect(
      resolveMusicCover({ title: "星晴", artist: "周杰伦", entity: "song" }, { fetch: fetchImpl }),
    ).resolves.toBe("https://is1-ssl.mzstatic.com/image/thumb/Music/tw/xingqing/600x600bb.jpg");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(itunesUrl(fetchImpl.mock.calls[0][0] as RequestInfo | URL).searchParams.get("country")).toBe("us");
    expect(itunesUrl(fetchImpl.mock.calls[1][0] as RequestInfo | URL).searchParams.get("country")).toBe("tw");
  });

  it("returns null instead of taking the first iTunes result when nothing matches", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const host = hostnameOf(input);
      if (host === "itunes.apple.com") {
        return new Response(
          JSON.stringify({
            results: [
              {
                trackName: "别的歌",
                artistName: "别人",
                artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/nope/100x100bb.jpg",
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (host === "musicbrainz.org") {
        return new Response(JSON.stringify({ releases: [] }), { status: 200 });
      }
      throw new Error(`unexpected fetch ${String(input)}`);
    });

    await expect(
      resolveMusicCover({ title: "星晴", artist: "周杰伦", entity: "song" }, { fetch: fetchImpl }),
    ).resolves.toBeNull();
    // us + tw + hk + musicbrainz
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("falls back to the canonical Cover Art Archive URL without following redirects", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const host = hostnameOf(input);
      if (host === "itunes.apple.com") {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      if (host === "musicbrainz.org") {
        return new Response(
          JSON.stringify({ releases: [{ id: "mbid-transient-only", title: "Obscure Album", score: 95 }] }),
          { status: 200 },
        );
      }
      if (host === "coverartarchive.org" && init?.method === "HEAD") {
        expect(init.redirect).toBe("manual");
        return new Response(null, {
          status: 307,
          headers: { Location: "https://ia800000.us.archive.org/download/mbid-front/front.jpg" },
        });
      }
      throw new Error(`unexpected fetch ${String(input)}`);
    });

    const result = await resolveMusicCover(
      { title: "Obscure Album", artist: "Band", entity: "album" },
      { fetch: fetchImpl },
    );
    expect(result).toBe("https://coverartarchive.org/release/mbid-transient-only/front-500");
    expect(new URL(result!).hostname).toBe("coverartarchive.org");
    // 3 iTunes countries (empty) + MB + CAA
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    const mbCall = fetchImpl.mock.calls.find((call) => hostnameOf(call[0] as RequestInfo | URL) === "musicbrainz.org");
    expect(mbCall).toBeTruthy();
  });

  it("ignores MusicBrainz hits below score 90 or with mismatched titles", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const host = hostnameOf(input);
      if (host === "itunes.apple.com") {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      if (host === "musicbrainz.org") {
        return new Response(
          JSON.stringify({
            releases: [
              { id: "low-score", title: "Ambiguous", score: 80 },
              { id: "wrong-title", title: "Something Else", score: 100 },
            ],
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch ${String(input)}`);
    });

    await expect(
      resolveMusicCover({ title: "Ambiguous", artist: "Band", entity: "album" }, { fetch: fetchImpl }),
    ).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("returns null when every source fails", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
    await expect(resolveMusicCover({ title: "Missing", entity: "song" }, { fetch: fetchImpl })).resolves.toBeNull();
  });

  it("returns null for blank titles without fetching", async () => {
    const fetchImpl = vi.fn();
    await expect(resolveMusicCover({ title: "  ", entity: "album" }, { fetch: fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
