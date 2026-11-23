import { describe, expect, it } from "vitest";
import { isBookTrackingStatus, readStatusLabel } from "@/lib/read-status";
import { isDuplicateBookEntry, normalizeAuthorNames } from "@/lib/books/dedupe";
import { parseBookBulkStatus, parseBulkStatus, AdminInputError } from "@/lib/admin/list-params";
import { parseMediaForm } from "@/lib/admin/media-form";

describe("readStatusLabel", () => {
  it("maps book tracking statuses to zh labels", () => {
    expect(readStatusLabel("want_to_watch")).toBe("想读");
    expect(readStatusLabel("in_progress")).toBe("在读");
    expect(readStatusLabel("watched")).toBe("读过");
    expect(readStatusLabel("watching")).toBeNull();
    expect(readStatusLabel(null)).toBeNull();
  });

  it("accepts only book tracking statuses", () => {
    expect(isBookTrackingStatus("in_progress")).toBe(true);
    expect(isBookTrackingStatus("watching")).toBe(false);
  });
});

describe("book form validation", () => {
  function form(values: Record<string, string> = {}) {
    const data = new FormData();
    for (const [key, value] of Object.entries({
      type: "book",
      title: "测试书",
      status: "in_progress",
      ...values,
    }))
      data.set(key, value);
    return data;
  }

  it("parses authors, page_count, publisher, isbn, regions and reading status", () => {
    expect(
      parseMediaForm(
        form({
          page_count: "320",
          publisher: "测验社",
          isbn: "978-0-306-40615-7",
          authors: "\t作者甲\n\t作者乙",
          languages: "汉语",
          regions: "中国\n美国",
          status: "in_progress",
        }),
      ),
    ).toMatchObject({
      type: "book",
      page_count: 320,
      publisher: "测验社",
      isbn: "9780306406157",
      status: "in_progress",
      languages: ["汉语"],
      regions: ["中国", "美国"],
      authors: [
        { id: null, name: "作者甲" },
        { id: null, name: "作者乙" },
      ],
    });
  });

  it("rejects page_count 0", () => {
    expect(() => parseMediaForm(form({ page_count: "0" }))).toThrow(/页数/);
  });

  it("rejects invalid isbn", () => {
    expect(() => parseMediaForm(form({ isbn: "not-isbn" }))).toThrow(/ISBN/);
  });

  it("accepts open library book cover urls", () => {
    expect(
      parseMediaForm(
        form({
          cover_url: "https://covers.openlibrary.org/b/isbn/9780306406157-L.jpg",
        }),
      ).cover_url,
    ).toContain("covers.openlibrary.org");
  });
});

describe("book dedupe helpers", () => {
  it("normalizes author names like music artists", () => {
    expect(normalizeAuthorNames(["  Alice  ", "alice", "Bob"])).toEqual(["alice", "bob"]);
  });

  it("detects same title and author set", () => {
    expect(
      isDuplicateBookEntry({
        title: "  书名  ",
        authors: ["甲", "乙"],
        existingTitle: "书名",
        existingAuthors: ["乙", "甲"],
      }),
    ).toBe(true);
    expect(
      isDuplicateBookEntry({
        title: "书名",
        authors: ["甲"],
        existingTitle: "书名",
        existingAuthors: ["甲", "乙"],
      }),
    ).toBe(false);
  });
});

describe("bulk status parsers", () => {
  it("rejects in_progress for movie/tv bulk status", () => {
    expect(parseBulkStatus("watched")).toBe("watched");
    expect(() => parseBulkStatus("in_progress")).toThrow(AdminInputError);
  });

  it("accepts in_progress for book bulk status", () => {
    expect(parseBookBulkStatus("in_progress")).toBe("in_progress");
    expect(parseBookBulkStatus("want_to_watch")).toBe("want_to_watch");
    expect(() => parseBookBulkStatus("watching")).toThrow(AdminInputError);
  });
});
