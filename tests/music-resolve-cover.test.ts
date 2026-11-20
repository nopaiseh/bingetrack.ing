import { describe, expect, it, vi } from "vitest";
import { resolveMusicCover, upscaleItunesArtworkUrl } from "@/lib/music/resolve-cover";

/** 用 URL 主机名精确匹配，避免子串误伤（CodeQL）。 */
function hostnameOf(input: RequestInfo | URL): string {
  return new URL(String(input)).hostname;
}

describe("upscaleItunesArtworkUrl", () => {
  it("replaces the bb size segment with 600x600", () => {
    expect(
      upscaleItunesArtworkUrl("https://is1-ssl.mzstatic.com/image/thumb/Music/x/y/z/cover.jpg/100x100bb.jpg"),
    ).toBe("https://is1-ssl.mzstatic.com/image/thumb/Music/x/y/z/cover.jpg/600x600bb.jpg");
  });
});

describe("resolveMusicCover", () => {
  it("prefers iTunes artwork and does not call MusicBrainz when iTunes succeeds", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const host = hostnameOf(input);
      if (host === "itunes.apple.com") {
        return new Response(
          JSON.stringify({
            results: [
              {
                collectionName: "Test Album",
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

  it("falls back to the canonical Cover Art Archive URL without following redirects", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const host = hostnameOf(input);
      if (host === "itunes.apple.com") {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      if (host === "musicbrainz.org") {
        return new Response(JSON.stringify({ releases: [{ id: "mbid-transient-only", score: 95 }] }), {
          status: 200,
        });
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
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const mbCall = fetchImpl.mock.calls.find((call) => hostnameOf(call[0] as RequestInfo | URL) === "musicbrainz.org");
    expect(mbCall).toBeTruthy();
  });

  it("ignores MusicBrainz hits below score 90", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const host = hostnameOf(input);
      if (host === "itunes.apple.com") {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      if (host === "musicbrainz.org") {
        return new Response(JSON.stringify({ releases: [{ id: "low-score", score: 80 }] }), { status: 200 });
      }
      throw new Error(`unexpected fetch ${String(input)}`);
    });

    await expect(
      resolveMusicCover({ title: "Ambiguous", artist: "Band", entity: "album" }, { fetch: fetchImpl }),
    ).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
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
