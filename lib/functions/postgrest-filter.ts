/** Quote a value embedded in a raw PostgREST filter expression. */
export function quotePostgrestFilterValue(value: string): string {
  return `"${value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')}"`;
}
