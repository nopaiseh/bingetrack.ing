import { describe, expect, it, vi } from "vitest";
import { normalizeIsbn, resolveBookCover, sanitizeBookCoverUrl } from "@/lib/books/resolve-cover";

/** 用 URL 主机名精确匹配，避免子串误伤（CodeQL）。 */
function hostnameOf(input: RequestInfo | URL): string {
  return new URL(String(input)).hostname;
}

describe("normalizeIsbn", () => {
  it("去掉空格与连字符并把 x 转大写", () => {
    expect(normalizeIsbn("978-0-306-40615-7")).toBe("9780306406157");
    expect(normalizeIsbn("0-306-40615-x")).toBe("030640615X");
    expect(normalizeIsbn("  030640615X  ")).toBe("030640615X");
  });

  it("空值与非法格式返回 null", () => {
    expect(normalizeIsbn(null)).toBeNull();
    expect(normalizeIsbn("")).toBeNull();
    expect(normalizeIsbn("   ")).toBeNull();
    expect(normalizeIsbn("12345")).toBeNull();
    expect(normalizeIsbn("abcdefghij")).toBeNull();
    expect(normalizeIsbn("978030640615")).toBeNull();
    expect(normalizeIsbn("030640615Y")).toBeNull();
  });
});

describe("sanitizeBookCoverUrl", () => {
  it("强制 https、去掉 edge=curl，并只接受白名单主机", () => {
    expect(
      sanitizeBookCoverUrl(
        "http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api",
      ),
    ).toBe("https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&source=gbs_api");
    expect(sanitizeBookCoverUrl("https://covers.openlibrary.org/b/isbn/9780306406157-L.jpg?default=false")).toContain(
      "covers.openlibrary.org",
    );
    expect(sanitizeBookCoverUrl("https://books.googleusercontent.com/books/content?id=x")).toContain(
      "books.googleusercontent.com",
    );
  });

  it("拒绝非 https 与非白名单主机", () => {
    expect(sanitizeBookCoverUrl("ftp://books.google.com/x")).toBeNull();
    expect(sanitizeBookCoverUrl("https://evil.example/cover.jpg")).toBeNull();
    expect(sanitizeBookCoverUrl("https://user:pass@books.google.com/x")).toBeNull();
    expect(sanitizeBookCoverUrl("https://books.google.com:8443/x")).toBeNull();
    expect(sanitizeBookCoverUrl("https://image.tmdb.org/t/p/w500/a.jpg")).toBeNull();
  });
});

describe("resolveBookCover", () => {
  it("Open Library 命中时不请求 Google Books", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const host = hostnameOf(input);
      if (host === "covers.openlibrary.org") {
        expect(init?.method).toBe("HEAD");
        return new Response(null, { status: 200 });
      }
      throw new Error(`unexpected fetch ${String(input)}`);
    });

    await expect(resolveBookCover({ isbn: "978-0-306-40615-7" }, { fetch: fetchImpl })).resolves.toBe(
      "https://covers.openlibrary.org/b/isbn/9780306406157-L.jpg?default=false",
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("Open Library 404 时回退 Google Books thumbnail", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const host = hostnameOf(input);
      if (host === "covers.openlibrary.org") {
        return new Response(null, { status: 404 });
      }
      if (host === "www.googleapis.com") {
        return new Response(
          JSON.stringify({
            items: [
              {
                volumeInfo: {
                  imageLinks: {
                    thumbnail:
                      "http://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api",
                    smallThumbnail: "http://books.google.com/books/content?id=zyTCAlFPjgYC&zoom=5",
                  },
                },
              },
            ],
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch ${String(input)}`);
    });

    const result = await resolveBookCover({ isbn: "9780306406157" }, { fetch: fetchImpl });
    expect(result).toBe(
      "https://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover&img=1&zoom=1&source=gbs_api",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("全部来源失败时返回 null", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
    await expect(resolveBookCover({ isbn: "9780306406157" }, { fetch: fetchImpl })).resolves.toBeNull();
  });

  it("非法 ISBN 不发起请求", async () => {
    const fetchImpl = vi.fn();
    await expect(resolveBookCover({ isbn: "not-an-isbn" }, { fetch: fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("Google Books 返回非白名单主机时丢弃", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const host = hostnameOf(input);
      if (host === "covers.openlibrary.org") return new Response(null, { status: 404 });
      if (host === "www.googleapis.com") {
        return new Response(
          JSON.stringify({
            items: [{ volumeInfo: { imageLinks: { thumbnail: "https://evil.example/cover.jpg" } } }],
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch ${String(input)}`);
    });
    await expect(resolveBookCover({ isbn: "9780306406157" }, { fetch: fetchImpl })).resolves.toBeNull();
  });
});
