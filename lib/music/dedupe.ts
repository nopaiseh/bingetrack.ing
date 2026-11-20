/**
 * 音乐／专辑去重：规范化标题 + 同一组艺人（忽略大小写与多余空白）视为同一条目。
 * 与数据库函数 public.normalize_media_title / find_music_by_title_and_artists 对齐，供导入管道先比对再写入。
 */

/** 去首尾空白、折叠内部空白并小写。 */
export function normalizeMediaTitle(title: string | null | undefined): string {
  return (title ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** 艺人名称列表规范化后去重排序，便于集合比较。 */
export function normalizeArtistNames(names: readonly string[] | null | undefined): string[] {
  const keys = new Set<string>();
  for (const name of names ?? []) {
    const key = normalizeMediaTitle(name);
    if (key) keys.add(key);
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

/** 两套艺人名单在规范化后是否为同一集合。 */
export function sameArtistSet(
  left: readonly string[] | null | undefined,
  right: readonly string[] | null | undefined,
): boolean {
  const a = normalizeArtistNames(left);
  const b = normalizeArtistNames(right);
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

/**
 * 判断候选是否与已有条目重复：类型相同、规范化标题相同、艺人集合相同。
 * 不查库；调用方用 find_music_by_title_and_artists 或本函数在内存中过滤。
 */
export function isDuplicateMusicEntry(options: {
  title: string;
  artists: readonly string[];
  existingTitle: string;
  existingArtists: readonly string[];
}): boolean {
  return (
    normalizeMediaTitle(options.title) === normalizeMediaTitle(options.existingTitle) &&
    sameArtistSet(options.artists, options.existingArtists)
  );
}

export type FindMusicDuplicateParams = {
  type: "music" | "album";
  title: string;
  artists?: readonly string[];
};

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: string | null; error: { message?: string } | null }>;
};

/**
 * 调用数据库去重函数；命中已有条目时返回其 UUID，否则 null。
 * 失败时抛出，由导入流程决定重试或跳过。
 */
export async function findMusicDuplicateId(db: RpcClient, params: FindMusicDuplicateParams): Promise<string | null> {
  const { data, error } = await db.rpc("find_music_by_title_and_artists", {
    p_type: params.type,
    p_title: params.title,
    p_artist_names: [...(params.artists ?? [])],
  });
  if (error) throw new Error(error.message ?? "find_music_by_title_and_artists failed");
  return data ?? null;
}
