import { describe, expect, it, vi } from "vitest";
import { resolveMusicCover, upscaleItunesArtworkUrl } from "@/lib/music/resolve-cover";

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
      const url = String(input);
      if (url.includes("itunes.apple.com")) {
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
      throw new Error(`unexpected fetch ${url}`);
    });

    await expect(
      resolveMusicCover({ title: "Test Album", artist: "Someone", entity: "album" }, { fetch: fetchImpl }),
    ).resolves.toBe("https://is1-ssl.mzstatic.com/image/thumb/Music/a/b/c/cover.jpg/600x600bb.jpg");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("falls back to Cover Art Archive via a transient MusicBrainz lookup", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("itunes.apple.com")) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      if (url.includes("musicbrainz.org")) {
        return new Response(JSON.stringify({ releases: [{ id: "mbid-transient-only" }] }), { status: 200 });
      }
      if (url.includes("coverartarchive.org") && init?.method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: { Location: "https://archive.org/download/mbid-front/front.jpg" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    // undici/Response.url for a constructed Response is empty; helper returns caa URL or followed url.
    const result = await resolveMusicCover(
      { title: "Obscure Album", artist: "Band", entity: "album" },
      { fetch: fetchImpl },
    );
    expect(result).toContain("coverartarchive.org/release/mbid-transient-only/front-500");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const mbCall = fetchImpl.mock.calls.find((call) => String(call[0]).includes("musicbrainz.org"));
    expect(mbCall).toBeTruthy();
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
