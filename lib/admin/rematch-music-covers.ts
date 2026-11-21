/**
 * 后台批量重新匹配音乐封面：仅处理 cover_url 主机为 *.mzstatic.com 的专辑／曲目。
 * 预览用新规则解析；提交只更新勾选条目。不改表结构、不加迁移。
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMediaId } from "@/lib/functions/media-id";
import { resolveMusicCover, type ResolveMusicCoverDeps } from "@/lib/music/resolve-cover";
import { affectedMediaIds, revalidateMediaItems } from "@/lib/admin/revalidate-media";

export const REMATCH_BATCH_SIZE = 50;
export const REMATCH_CONCURRENCY = 3;

export type RematchMusicItem = {
  id: string;
  type: "album" | "music";
  title: string;
  cover_url: string;
  artist: string | null;
};

export type RematchPreviewRow = {
  id: string;
  type: "album" | "music";
  title: string;
  artist: string | null;
  oldCover: string;
  newCover: string | null;
  /** 新图与旧图不同，或将清空。 */
  willChange: boolean;
};

export type RematchApplyItem = {
  id: string;
  /** null 表示清空封面（无匹配）。 */
  cover_url: string | null;
};

export type RematchApplyResult = {
  succeeded: number;
  failed: number;
  cleared: number;
};

/** cover_url 是否为 iTunes／Apple Music 图床（*.mzstatic.com）。 */
export function isMzstaticCoverUrl(coverUrl: string | null | undefined): boolean {
  if (!coverUrl?.trim()) return false;
  try {
    const url = new URL(coverUrl.trim());
    return url.protocol === "https:" && url.hostname.endsWith(".mzstatic.com");
  } catch {
    return false;
  }
}

function relatedOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** 有限并发执行，避免一次打满外部 API 与函数时长。 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, Math.floor(concurrency));
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

/**
 * 列出封面主机为 *.mzstatic.com 的专辑与曲目（最多 limit 条）。
 * 先用 ilike 粗筛，再按主机名严格过滤。
 */
export async function listMzstaticMusicItems(
  db: SupabaseClient,
  options: { limit?: number; offset?: number } = {},
): Promise<RematchMusicItem[]> {
  const limit = Math.min(Math.max(1, options.limit ?? REMATCH_BATCH_SIZE), REMATCH_BATCH_SIZE);
  const offset = Math.max(0, options.offset ?? 0);

  const { data, error } = await db
    .from("media_items")
    .select("id,type,title,cover_url")
    .in("type", ["album", "music"])
    .not("cover_url", "is", null)
    .ilike("cover_url", "%mzstatic.com%")
    .order("type", { ascending: true })
    .order("title", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw new Error("无法读取音乐封面列表，请重试。");

  const rows = (data ?? []).filter(
    (row): row is { id: string; type: "album" | "music"; title: string; cover_url: string } =>
      (row.type === "album" || row.type === "music") &&
      typeof row.id === "string" &&
      typeof row.title === "string" &&
      typeof row.cover_url === "string" &&
      isMzstaticCoverUrl(row.cover_url),
  );

  if (rows.length === 0) return [];

  const { data: creditRows, error: creditError } = await db
    .from("media_credits")
    .select("media_item_id, people(name)")
    .in(
      "media_item_id",
      rows.map((row) => row.id),
    )
    .eq("role", "artist");

  if (creditError) throw new Error("无法读取艺人资料，请重试。");

  const artistById = new Map<string, string>();
  for (const row of creditRows ?? []) {
    const mediaId = row.media_item_id as string;
    if (artistById.has(mediaId)) continue;
    const person = relatedOne(row.people as { name: string } | { name: string }[] | null);
    if (person?.name) artistById.set(mediaId, person.name);
  }

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    cover_url: row.cover_url,
    artist: artistById.get(row.id) ?? null,
  }));
}

/** 按新规则重新解析一批条目，生成预览（不写库）。 */
export async function previewMusicCoverRematch(
  items: readonly RematchMusicItem[],
  deps: ResolveMusicCoverDeps = {},
): Promise<RematchPreviewRow[]> {
  const batch = items.slice(0, REMATCH_BATCH_SIZE);
  return mapWithConcurrency(batch, REMATCH_CONCURRENCY, async (item) => {
    const newCover = await resolveMusicCover(
      {
        title: item.title,
        artist: item.artist,
        entity: item.type === "album" ? "album" : "song",
      },
      deps,
    ).catch(() => null);
    const willChange = newCover !== item.cover_url;
    return {
      id: item.id,
      type: item.type,
      title: item.title,
      artist: item.artist,
      oldCover: item.cover_url,
      newCover,
      willChange,
    };
  });
}

/**
 * 仅更新勾选条目的 cover_url。非 mzstatic 旧图、非专辑／曲目、非法 id 计失败。
 * cover_url 为 null 时清空（无匹配将清空）。
 */
export async function applyMusicCoverRematch(
  db: SupabaseClient,
  updates: readonly RematchApplyItem[],
): Promise<RematchApplyResult> {
  const batch = updates.slice(0, REMATCH_BATCH_SIZE);
  const ids = batch.map((row) => row.id).filter(isMediaId);
  if (ids.length === 0) return { succeeded: 0, failed: batch.length, cleared: 0 };

  const { data: existing, error } = await db
    .from("media_items")
    .select("id,type,cover_url")
    .in("id", ids)
    .in("type", ["album", "music"]);

  if (error) throw new Error("无法校验音乐条目，请重试。");

  const byId = new Map(
    (existing ?? []).map((row) => [
      row.id as string,
      { type: row.type as string, cover_url: row.cover_url as string | null },
    ]),
  );

  let succeeded = 0;
  let failed = 0;
  let cleared = 0;
  const touched: string[] = [];

  for (const update of batch) {
    if (!isMediaId(update.id)) {
      failed += 1;
      continue;
    }
    const current = byId.get(update.id);
    if (!current || (current.type !== "album" && current.type !== "music")) {
      failed += 1;
      continue;
    }
    if (!isMzstaticCoverUrl(current.cover_url)) {
      failed += 1;
      continue;
    }
    if (update.cover_url != null && update.cover_url !== "" && !isAllowedRematchCover(update.cover_url)) {
      failed += 1;
      continue;
    }

    const nextCover = update.cover_url?.trim() || null;
    const { data, error: writeError } = await db
      .from("media_items")
      .update({ cover_url: nextCover })
      .eq("id", update.id)
      .in("type", ["album", "music"])
      .select("id");

    if (writeError || !data?.length) {
      failed += 1;
      continue;
    }
    succeeded += 1;
    if (!nextCover) cleared += 1;
    touched.push(update.id);
  }

  if (touched.length > 0) {
    revalidateMediaItems(await affectedMediaIds(db, touched));
  }

  return { succeeded, failed, cleared };
}

/** 重新匹配后允许写入的封面主机（与表单白名单一致的音乐相关域）。 */
function isAllowedRematchCover(coverUrl: string): boolean {
  try {
    const url = new URL(coverUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname;
    return (
      host.endsWith(".mzstatic.com") ||
      host === "coverartarchive.org" ||
      host === "archive.org" ||
      host.endsWith(".archive.org")
    );
  } catch {
    return false;
  }
}

/** 解析提交的勾选更新：id + 可选新封面（缺省或空串视为清空）。 */
export function parseRematchApplyPayload(raw: unknown): RematchApplyItem[] {
  if (!Array.isArray(raw)) return [];
  const items: RematchApplyItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const id = String((row as { id?: unknown }).id ?? "");
    if (!isMediaId(id)) continue;
    const coverRaw = (row as { cover_url?: unknown }).cover_url;
    if (coverRaw == null || coverRaw === "") {
      items.push({ id, cover_url: null });
      continue;
    }
    if (typeof coverRaw !== "string") continue;
    if (!isAllowedRematchCover(coverRaw)) continue;
    items.push({ id, cover_url: coverRaw });
  }
  return items.slice(0, REMATCH_BATCH_SIZE);
}
