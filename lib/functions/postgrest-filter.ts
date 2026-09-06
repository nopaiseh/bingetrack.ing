// 为原始 PostgREST 表达式中的值加引号并转义，保留搜索词中的标点和 ILIKE 通配符。
export function quotePostgrestFilterValue(value: string): string {
  return `"${value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')}"`;
}
