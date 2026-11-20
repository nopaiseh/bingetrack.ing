/**
 * 图书去重：规范化标题 + 同一组作者（忽略大小写与多余空白）视为同一条目。
 * 与 public.normalize_media_title / find_book_by_title_and_authors 对齐。
 */

import { normalizeArtistNames, normalizeMediaTitle, sameArtistSet } from "@/lib/music/dedupe";

export { normalizeMediaTitle };

/** 作者名称列表规范化后去重排序。 */
export function normalizeAuthorNames(names: readonly string[] | null | undefined): string[] {
  return normalizeArtistNames(names);
}

/** 两套作者名单在规范化后是否为同一集合。 */
export function sameAuthorSet(
  left: readonly string[] | null | undefined,
  right: readonly string[] | null | undefined,
): boolean {
  return sameArtistSet(left, right);
}

/** 判断候选是否与已有图书重复：规范化标题相同且作者集合相同。 */
export function isDuplicateBookEntry(options: {
  title: string;
  authors: readonly string[];
  existingTitle: string;
  existingAuthors: readonly string[];
}): boolean {
  return (
    normalizeMediaTitle(options.title) === normalizeMediaTitle(options.existingTitle) &&
    sameAuthorSet(options.authors, options.existingAuthors)
  );
}

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: string | null; error: { message?: string } | null }>;
};

/** 调用数据库去重函数；命中已有图书时返回其 UUID，否则 null。 */
export async function findBookDuplicateId(
  db: RpcClient,
  params: { title: string; authors?: readonly string[] },
): Promise<string | null> {
  const { data, error } = await db.rpc("find_book_by_title_and_authors", {
    p_title: params.title,
    p_author_names: [...(params.authors ?? [])],
  });
  if (error) throw new Error(error.message ?? "find_book_by_title_and_authors failed");
  return data ?? null;
}
