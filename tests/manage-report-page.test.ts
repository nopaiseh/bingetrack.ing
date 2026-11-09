import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireOwner } from "@/lib/auth/server";

vi.mock("@/lib/auth/server", () => ({ requireOwner: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const error = new Error("NEXT_REDIRECT");
    throw Object.assign(error, { url });
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

import ReportPage from "@/app/(admin)/manage/reports/[report]/page";

type QueryError = { code?: string; message?: string };
type QueryResult = { data?: unknown; count?: number | null; error?: QueryError | null; status?: number };
type BuiltQuery = { table: string; select: unknown[]; ilike: unknown[] | null; range: unknown[] | null };

/** 记录报告查询的筛选与分页，按查询形态返回结果。 */
function fakeDb(respond: (query: BuiltQuery) => QueryResult) {
  const queries: BuiltQuery[] = [];
  const from = vi.fn((table: string) => {
    const query: BuiltQuery = { table, select: [], ilike: null, range: null };
    queries.push(query);
    const builder: Record<string, unknown> = {
      then: (onfulfilled: (value: QueryResult) => unknown, onrejected?: (reason: unknown) => unknown) => Promise.resolve(respond(query)).then(onfulfilled, onrejected),
    };
    const chain = (name: string) => (...args: unknown[]) => {
      if (name === "select") query.select = args;
      if (name === "ilike") query.ilike = args;
      if (name === "range") query.range = args;
      return builder;
    };
    for (const name of ["select", "ilike", "order", "range"]) builder[name] = chain(name);
    return builder;
  });
  return { db: { from }, queries };
}

function load(search: { q?: string; page?: string }, db: { from: ReturnType<typeof vi.fn> }) {
  vi.mocked(requireOwner).mockResolvedValue({ db, user: {} } as unknown as Awaited<ReturnType<typeof requireOwner>>);
  return ReportPage({ params: Promise.resolve({ report: "missing-alias" }), searchParams: Promise.resolve(search) });
}

async function redirectedTo(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") return (error as Error & { url: string }).url;
    throw error;
  }
  throw new Error("expected redirect");
}

describe("报告分页越界", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("页码超出结果集时跳到最后一页，并保留搜索词", async () => {
    const { db, queries } = fakeDb(query => query.range
      ? { data: null, count: null, error: { code: "PGRST103", message: "Requested range not satisfiable" }, status: 416 }
      : { count: 40, error: null, status: 200 });
    const url = await redirectedTo(() => load({ q: "a_b%", page: "4" }, db));
    const target = new URL(url, "https://example.test");
    expect(target.pathname).toBe("/manage/reports/missing-alias");
    expect(target.searchParams.get("q")).toBe("a_b%");
    expect(target.searchParams.get("page")).toBe("2");
    expect(queries.map(query => query.table)).toEqual(["v_report_missing_alias", "v_report_missing_alias"]);
    expect(queries[0].range).toEqual([75, 99]);
    expect(queries[1].range).toBeNull();
    expect(queries[1].select[1]).toMatchObject({ count: "exact", head: true });
    expect(queries[1].ilike).toEqual(["title", "%a\\_b\\%%"]);
  });

  it("没有条目时回到第 1 页，并保留空的搜索参数", async () => {
    const { db } = fakeDb(query => query.range
      ? { error: { message: "Requested range not satisfiable" }, status: 416 }
      : { count: 0, error: null, status: 200 });
    expect(await redirectedTo(() => load({ q: "", page: "2" }, db))).toBe("/manage/reports/missing-alias?q=&page=1");
  });

  it("其他数据库错误仍抛出固定说明，并把 code 与 message 放在 cause 中", async () => {
    const { db, queries } = fakeDb(() => ({ data: null, count: null, error: { code: "42703", message: "column does not exist" }, status: 400 }));
    await expect(load({ q: "", page: "1" }, db)).rejects.toMatchObject({
      message: "无法读取报告，请确认数据库迁移已应用后重试。",
      cause: { code: "42703", message: "column does not exist" },
    });
    await expect(load({ q: "", page: "1" }, db)).rejects.toSatisfy((error: Error) => !error.message.includes("42703") && !error.message.includes("column"));
    expect(queries).toHaveLength(2);
    expect(queries.every(query => query.range)).toBe(true);
  });
});
