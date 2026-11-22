/**
 * 服务端图书封面解析：封面留空且有 ISBN 时按 Open Library → Google Books 顺序尝试。
 * 只返回可写入 cover_url 的 https 白名单 URL；失败返回 null，错误不抛给用户。
 */

export type ResolveBookCoverInput = {
  isbn: string;
};

export type ResolveBookCoverDeps = {
  fetch?: typeof fetch;
};

const OPEN_LIBRARY_COVER = "https://covers.openlibrary.org/b/isbn";
const GOOGLE_BOOKS_API = "https://www.googleapis.com/books/v1/volumes";
const FETCH_TIMEOUT_MS = 4_000;

/** 可写入 cover_url／CSP img-src 的图书封面主机。 */
export const BOOK_COVER_HOSTS = new Set(["covers.openlibrary.org", "books.google.com", "books.googleusercontent.com"]);

const NORMALIZED_ISBN = /^(?:\d{9}[\dX]|\d{13})$/;

/**
 * 规范化 ISBN：去掉空格与连字符，x 转大写。
 * 空值返回 null；格式非法也返回 null（不抛错，供解析封面使用）。
 */
export function normalizeIsbn(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const normalized = raw
    .trim()
    .replace(/[\s-]+/g, "")
    .toUpperCase();
  if (!normalized) return null;
  if (!NORMALIZED_ISBN.test(normalized)) return null;
  return normalized;
}

/** 校验主机是否在图书封面白名单内（不含 TMDB；表单层另允许 TMDB）。 */
export function isAllowedBookCoverHost(hostname: string): boolean {
  return BOOK_COVER_HOSTS.has(hostname);
}

/**
 * 把候选封面 URL 收成可落库地址：只接受 https、无用户信息／端口，主机须在白名单。
 * Google Books 常见 http 与 edge=curl 在此统一处理。
 */
export function sanitizeBookCoverUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let candidate = raw.trim();
  if (candidate.startsWith("http://")) candidate = `https://${candidate.slice("http://".length)}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (!isAllowedBookCoverHost(url.hostname)) return null;
  url.searchParams.delete("edge");
  return url.href;
}

type GoogleBooksVolume = {
  volumeInfo?: {
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
  };
};

type GoogleBooksResponse = {
  items?: GoogleBooksVolume[];
};

async function resolveFromOpenLibrary(isbn: string, fetchImpl: typeof fetch): Promise<string | null> {
  const coverUrl = `${OPEN_LIBRARY_COVER}/${encodeURIComponent(isbn)}-L.jpg?default=false`;
  const response = await fetchImpl(coverUrl, {
    method: "HEAD",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  // default=false 时无封面返回 404。
  if (!response.ok) return null;
  return sanitizeBookCoverUrl(coverUrl);
}

async function resolveFromGoogleBooks(isbn: string, fetchImpl: typeof fetch): Promise<string | null> {
  const url = new URL(GOOGLE_BOOKS_API);
  url.searchParams.set("q", `isbn:${isbn}`);
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as GoogleBooksResponse;
  for (const item of body.items ?? []) {
    const links = item.volumeInfo?.imageLinks;
    const raw = links?.thumbnail ?? links?.smallThumbnail;
    const sanitized = sanitizeBookCoverUrl(raw);
    if (sanitized) return sanitized;
  }
  return null;
}

/**
 * 按 ISBN 解析图书封面。无合法 ISBN 或全部来源失败时返回 null。
 */
export async function resolveBookCover(
  input: ResolveBookCoverInput,
  deps: ResolveBookCoverDeps = {},
): Promise<string | null> {
  const isbn = normalizeIsbn(input.isbn);
  if (!isbn) return null;
  const fetchImpl = deps.fetch ?? fetch;

  try {
    const openLibrary = await resolveFromOpenLibrary(isbn, fetchImpl);
    if (openLibrary) return openLibrary;
  } catch {
    /* 继续尝试 Google Books */
  }

  try {
    return await resolveFromGoogleBooks(isbn, fetchImpl);
  } catch {
    return null;
  }
}
