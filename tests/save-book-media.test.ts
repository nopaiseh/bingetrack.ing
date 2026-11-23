import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaInput } from "@/lib/admin/media-form";
import { SaveBookMediaError, saveBookMedia } from "@/lib/admin/save-book-media";
import { resolveBookCover } from "@/lib/books/resolve-cover";

vi.mock("@/lib/books/resolve-cover", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/books/resolve-cover")>();
  return {
    ...actual,
    resolveBookCover: vi.fn(async () => "https://covers.openlibrary.org/b/isbn/9780306406157-L.jpg?default=false"),
  };
});

function bookPayload(overrides: Partial<MediaInput> = {}): MediaInput {
  return {
    id: null,
    type: "book",
    title: "测试图书",
    alternate_title: "Original Title",
    summary: null,
    cover_url: null,
    release_date: "2020-01-01",
    runtime: null,
    parent_id: null,
    number: null,
    status: "want_to_watch",
    rating: null,
    genres: ["小说"],
    languages: ["汉语"],
    regions: [],
    actors: [],
    directors: [],
    artists: [],
    lyricists: [],
    composers: [],
    authors: [{ id: null, name: "作者" }],
    label: null,
    page_count: 200,
    publisher: "出版社",
    isbn: null,
    collections: [],
    ...overrides,
  };
}

function rpcDb(handlers: Record<string, (args: Record<string, unknown>) => { data?: unknown; error?: unknown }>) {
  return {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      const handler = handlers[fn];
      if (!handler) return { data: null, error: { message: `missing ${fn}` } };
      return handler(args);
    }),
  };
}

describe("saveBookMedia", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("查重后调用 manage_save_media 写入图书", async () => {
    const db = rpcDb({
      find_book_by_title_and_authors: () => ({ data: null, error: null }),
      manage_save_media: () => ({ data: "b1000000-0000-4000-8000-000000000099", error: null }),
    });
    const id = await saveBookMedia(db as never, bookPayload({ status: "in_progress" }));
    expect(id).toBe("b1000000-0000-4000-8000-000000000099");
    expect(db.rpc).toHaveBeenCalledWith("find_book_by_title_and_authors", {
      p_title: "测试图书",
      p_author_names: ["作者"],
    });
    expect(db.rpc).toHaveBeenCalledWith(
      "manage_save_media",
      expect.objectContaining({
        p_data: expect.objectContaining({
          type: "book",
          status: "in_progress",
          page_count: 200,
          publisher: "出版社",
          languages: ["汉语"],
          regions: [],
          authors: [{ id: null, name: "作者" }],
        }),
      }),
    );
  });

  it("命中同名同作者时拒绝保存", async () => {
    const db = rpcDb({
      find_book_by_title_and_authors: () => ({ data: "b1000000-0000-4000-8000-000000000001", error: null }),
    });
    await expect(saveBookMedia(db as never, bookPayload())).rejects.toThrow(SaveBookMediaError);
    await expect(saveBookMedia(db as never, bookPayload())).rejects.toThrow(/同名同作者/);
  });

  it("拒绝非法页数", async () => {
    const db = rpcDb({});
    await expect(saveBookMedia(db as never, bookPayload({ page_count: 0 }))).rejects.toThrow(/页数/);
  });

  it("封面留空且有 ISBN 时自动解析封面", async () => {
    const db = rpcDb({
      find_book_by_title_and_authors: () => ({ data: null, error: null }),
      manage_save_media: () => ({ data: "b1000000-0000-4000-8000-000000000099", error: null }),
    });
    await saveBookMedia(db as never, bookPayload({ isbn: "9780306406157", cover_url: null }));
    expect(resolveBookCover).toHaveBeenCalledWith({ isbn: "9780306406157" });
    expect(db.rpc).toHaveBeenCalledWith(
      "manage_save_media",
      expect.objectContaining({
        p_data: expect.objectContaining({
          isbn: "9780306406157",
          cover_url: "https://covers.openlibrary.org/b/isbn/9780306406157-L.jpg?default=false",
        }),
      }),
    );
  });

  it("用户已填封面时不覆盖", async () => {
    const db = rpcDb({
      find_book_by_title_and_authors: () => ({ data: null, error: null }),
      manage_save_media: () => ({ data: "b1000000-0000-4000-8000-000000000099", error: null }),
    });
    const manual = "https://covers.openlibrary.org/b/isbn/9780306406157-L.jpg";
    await saveBookMedia(db as never, bookPayload({ isbn: "9780306406157", cover_url: manual }));
    expect(resolveBookCover).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledWith(
      "manage_save_media",
      expect.objectContaining({
        p_data: expect.objectContaining({ cover_url: manual }),
      }),
    );
  });

  it("拒绝未规范化的 ISBN", async () => {
    const db = rpcDb({});
    await expect(saveBookMedia(db as never, bookPayload({ isbn: "978-0-306-40615-7" }))).rejects.toThrow(/ISBN/);
  });
});
