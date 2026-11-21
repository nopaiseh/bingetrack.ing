// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import { MediaRepositoryError } from "@/lib/functions/media-repo";
import { findDbErrorFields, normalizeDbErrorCause, pickDbErrorFields, reportHandledError } from "@/lib/report-error";

describe("normalizeDbErrorCause / pickDbErrorFields", () => {
  it("把 PostgREST 对象收成带 code／message／details／hint 的 Error", () => {
    const raw = {
      code: "42703",
      message: 'column "authors" does not exist',
      details: null,
      hint: "Perhaps you meant authors_json.",
    };
    const cause = normalizeDbErrorCause(raw);
    expect(cause).toBeInstanceOf(Error);
    expect(cause).toMatchObject(raw);
    expect((cause as Error).name).toBe("42703");
    expect(pickDbErrorFields(cause)).toEqual({
      code: "42703",
      message: 'column "authors" does not exist',
      details: null,
      hint: "Perhaps you meant authors_json.",
    });
  });

  it("已是 Error 或不含数据库字段时原样返回", () => {
    const err = new Error("boom");
    expect(normalizeDbErrorCause(err)).toBe(err);
    expect(normalizeDbErrorCause({ message: "only message" })).toEqual({ message: "only message" });
    expect(pickDbErrorFields({ message: "only message" })).toBeNull();
  });
});

describe("findDbErrorFields", () => {
  it("从 MediaRepositoryError.cause 链取出 PostgREST 字段", () => {
    const wrapped = new MediaRepositoryError("fetch media list", {
      code: "PGRST116",
      message: "Results contain 0 rows",
      details: "The result contains 0 rows",
      hint: null,
    });
    expect(findDbErrorFields(wrapped)).toEqual({
      code: "PGRST116",
      message: "Results contain 0 rows",
      details: "The result contains 0 rows",
      hint: null,
    });
    expect(wrapped.operation).toBe("fetch media list");
    expect(wrapped.cause).toBeInstanceOf(Error);
  });
});

describe("reportHandledError", () => {
  beforeEach(() => {
    vi.mocked(Sentry.captureException).mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("上报 Sentry 时带上 db code／message／details／hint 与失败查询名", () => {
    const db = {
      code: "57014",
      message: "canceling statement due to statement timeout",
      details: "Query cancelled",
      hint: "Increase statement_timeout",
    };
    const error = new MediaRepositoryError("fetch media list", db);

    reportHandledError("Media API request failed:", error);

    expect(Sentry.captureException).toHaveBeenCalledOnce();
    const [, options] = vi.mocked(Sentry.captureException).mock.calls[0]!;
    expect(options).toMatchObject({
      extra: {
        message: "Media API request failed:",
        query: "fetch media list",
        db,
      },
      tags: {
        "db.code": "57014",
        "db.query": "fetch media list",
      },
      contexts: {
        postgrest: {
          code: "57014",
          message: "canceling statement due to statement timeout",
          details: "Query cancelled",
          hint: "Increase statement_timeout",
          query: "fetch media list",
        },
      },
    });
    // 不上报请求体或用户字段
    expect(JSON.stringify(options)).not.toContain("cookie");
    expect(JSON.stringify(options)).not.toContain("Authorization");
  });

  it("嵌套在 cause 链中的 MediaRepositoryError 仍通过 operation 写出 db.query", () => {
    const inner = new MediaRepositoryError("fetch album tracks", {
      code: "57014",
      message: "canceling statement due to statement timeout",
      details: null,
      hint: null,
    });
    const outer = new Error("wrapper", { cause: inner });

    reportHandledError("Album detail failed:", outer);

    expect(vi.mocked(Sentry.captureException).mock.calls[0]![1]).toMatchObject({
      extra: { query: "fetch album tracks" },
      tags: {
        "db.code": "57014",
        "db.query": "fetch album tracks",
      },
      contexts: {
        postgrest: {
          query: "fetch album tracks",
        },
      },
    });
  });

  it("直接传入 PostgREST 错误对象时同样写入 context", () => {
    reportHandledError("Failed to fetch ownership:", {
      code: "42501",
      message: "permission denied",
      details: null,
      hint: null,
    });
    expect(vi.mocked(Sentry.captureException).mock.calls[0]![1]).toMatchObject({
      tags: { "db.code": "42501" },
      contexts: {
        postgrest: {
          code: "42501",
          message: "permission denied",
          details: null,
          hint: null,
          query: null,
        },
      },
    });
  });
});
