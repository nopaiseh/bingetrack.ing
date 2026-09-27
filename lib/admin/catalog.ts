/** 管理区分类与关联表的固定映射，服务端不能接受任意表名。 */
export const referenceTypes = {
  people: { label: "人物", table: "people", link: "media_credits", key: "person_id", alternate: true },
  collections: { label: "系列", table: "media_series", link: "media_item_series", key: "series_id", alternate: true },
  genres: { label: "类型", table: "genres", link: "media_genres", key: "genre_id", alternate: false },
  regions: { label: "地区", table: "regions", link: "media_regions", key: "region_id", alternate: false },
  languages: { label: "语言", table: "languages", link: "media_languages", key: "language_id", alternate: false },
} as const;
export type ReferenceType = keyof typeof referenceTypes;
export type Choice = { id: string; name: string; detail?: string; cover_url?: string | null; character?: string | null };
/** 只允许八类管理内容中的关联资料类别。 */
export function isReferenceType(value: string): value is ReferenceType {
  return Object.hasOwn(referenceTypes, value);
}

/** 转义 LIKE 通配符与转义符，使输入的 %、_ 按字面匹配。 */
export function escapeLikePattern(term: string) {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** 生成多列模糊匹配的 PostgREST or 条件；值加引号，避免逗号、括号破坏过滤语法。 */
function ilikeAnyFilter(term: string, columns: string[]) {
  const quoted = `"${`%${escapeLikePattern(term)}%`.replace(/[\\"]/g, (char) => `\\${char}`)}"`;
  return columns.map((column) => `${column}.ilike.${quoted}`).join(",");
}

/** 生成名称与别名的 PostgREST or 条件。 */
export function nameOrAliasFilter(term: string) {
  return ilikeAnyFilter(term, ["name", "alternate_name"]);
}

/** 生成影视标题与副标题的 PostgREST or 条件。 */
export function titleOrAliasFilter(term: string) {
  return ilikeAnyFilter(term, ["title", "alternate_title"]);
}
