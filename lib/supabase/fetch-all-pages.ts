import "server-only";

/**
 * 与 supabase/config.toml 的 `api.max_rows` 一致。
 * 未显式 `.range()` 的查询会被 PostgREST 静默截断到此上限。
 */
export const POSTGREST_PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: unknown };

/**
 * 用 `.range(from, to)` 翻页读完整张结果集，避免超过 PostgREST 默认行数上限时丢行。
 * 调用方应对结果集加上稳定排序（唯一键），防止页间漏行／重复。
 */
export async function fetchAllPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = POSTGREST_PAGE_SIZE,
): Promise<PageResult<T>> {
  if (pageSize <= 0) throw new Error("pageSize must be positive");
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await loadPage(from, from + pageSize - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}
