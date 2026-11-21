/**
 * 后台批量重新匹配音乐封面：仅处理 cover_url 主机为 *.mzstatic.com 的专辑。
 * 曲目展示封面跟所属专辑，不再单独重配。预览用新规则解析；提交只更新勾选条目。不改表结构、不加迁移。
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMediaId } from "@/lib/functions/media-id";
import { resolveMusicCover, type ResolveMusicCoverDeps } from "@/lib/music/resolve-cover";
import { affectedMediaIds, revalidateMediaItems } from "@/lib/admin/revalidate-media";

/** 每批上限；兼顾 Vercel 函数时长。 */
export const REMATCH_BATCH_SIZE = 20;
export const REMATCH_CONCURRENCY = 3;
/** 整批预览总截止（毫秒），预留余量给响应序列化，对应 maxDuration=60。 */
export const REMATCH_PREVIEW_DEADLINE_MS = 50_000;

export type RematchMusicItem = {
  id: string;
  type: "album";
  title: string;
  cover_url: string;
  artist: string | null;
};

export type RematchPreviewRow = {
  id: string;
  type: "album";
  title: string;
  artist: string | null;
  oldCover: string;
  newCover: string | null;
  /** 新图与旧图不同，或将清空。 */
  willChange: boolean;
  /** 因整批截止时间未解析，留给下一批。 */
  skipped: boolean;
};

export type RematchApplyItem = {
  id: string;
  /** null 表示清空封面（无匹配）。 */
  cover_url: string | null;
  /** 预览时的旧封面；仅当库中当前值仍等于此值时才更新。 */
  expected_cover_url: string;
};

export type RematchApplyResult = {
  succeeded: number;
  failed: number;
  cleared: number;
  conflicted: number;
  /** 因封面已变而跳过的 id。 */
  conflictIds: string[];
  /** 成功写入的 id。 */
  succeededIds: string[];
};

export type ListMzstaticResult = {
  items: RematchMusicItem[];
  /** 本批最后一条的 id；下一批传 afterId。无条目时为入参 afterId。 */
  nextCursor: string | null;
  hasMore: boolean;
};

export type PreviewRematchResult = {
  rows: RematchPreviewRow[];
  /** 下一批游标：有跳过时指向首个未处理 id，否则为本批最后已处理 id。 */
  nextCursor: string | null;
  hasMore: boolean;
  skipped: number;
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
 * 带总截止时间的并发映射：领取任务前若已超时则剩余全部跳过。
 * 返回已完成结果与第一个被跳过的下标（无跳过则为 items.length）。
 */
export async function mapWithConcurrencyUntilDeadline<T, R>(
  items: readonly T[],
  concurrency: number,
  deadlineAt: number,
  worker: (item: T, index: number) => Promise<R>,
  now: () => number = Date.now,
): Promise<{ results: Array<R | undefined>; firstSkippedIndex: number }> {
  const limit = Math.max(1, Math.floor(concurrency));
  const results = new Array<R | undefined>(items.length);
  let next = 0;
  let firstSkippedIndex = items.length;

  async function run() {
    while (true) {
      if (now() >= deadlineAt) {
        firstSkippedIndex = Math.min(firstSkippedIndex, next);
        return;
      }
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  if (items.length > 0) {
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  }
  for (let i = 0; i < items.length; i += 1) {
    if (results[i] === undefined) {
      firstSkippedIndex = Math.min(firstSkippedIndex, i);
      break;
    }
  }
  return { results, firstSkippedIndex };
}

async function attachArtists(db: SupabaseClient, rows: RematchMusicItem[]): Promise<RematchMusicItem[]> {
  if (rows.length === 0) return rows;
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

  return rows.map((row) => ({ ...row, artist: artistById.get(row.id) ?? null }));
}

/**
 * 按 id 升序游标列出 *.mzstatic.com 封面的专辑（不含曲目）。
 * afterId 之后继续；会多读几页直到凑满 limit 或库耗尽。
 */
export async function listMzstaticMusicItems(
  db: SupabaseClient,
  options: { limit?: number; afterId?: string | null } = {},
): Promise<ListMzstaticResult> {
  const limit = Math.min(Math.max(1, options.limit ?? REMATCH_BATCH_SIZE), REMATCH_BATCH_SIZE);
  let cursor = options.afterId && isMediaId(options.afterId) ? options.afterId : null;
  const collected: Array<Omit<RematchMusicItem, "artist"> & { artist?: null }> = [];
  let exhausted = false;

  while (collected.length < limit && !exhausted) {
    const pageSize = Math.min(REMATCH_BATCH_SIZE * 2, Math.max((limit - collected.length) * 3, limit));
    let request = db
      .from("media_items")
      .select("id,type,title,cover_url")
      .eq("type", "album")
      .not("cover_url", "is", null)
      .ilike("cover_url", "%mzstatic.com%")
      .order("id", { ascending: true })
      .limit(pageSize);
    if (cursor) request = request.gt("id", cursor);

    const { data, error } = await request;
    if (error) throw new Error("无法读取音乐封面列表，请重试。");

    const page = data ?? [];
    if (page.length === 0) {
      exhausted = true;
      break;
    }

    for (const row of page) {
      cursor = String(row.id);
      if (
        row.type === "album" &&
        typeof row.id === "string" &&
        typeof row.title === "string" &&
        typeof row.cover_url === "string" &&
        isMzstaticCoverUrl(row.cover_url)
      ) {
        collected.push({
          id: row.id,
          type: "album",
          title: row.title,
          cover_url: row.cover_url,
          artist: null,
        });
        if (collected.length >= limit) break;
      }
    }
    if (page.length < pageSize) exhausted = true;
  }

  const withArtists = await attachArtists(
    db,
    collected.map((row) => ({ ...row, artist: null })),
  );
  const nextCursor = withArtists.length > 0 ? withArtists[withArtists.length - 1].id : (options.afterId ?? null);

  let hasMore = false;
  if (withArtists.length >= limit && nextCursor) {
    const { data: probeRows, error: probeError } = await db
      .from("media_items")
      .select("id,type,cover_url")
      .eq("type", "album")
      .not("cover_url", "is", null)
      .ilike("cover_url", "%mzstatic.com%")
      .order("id", { ascending: true })
      .gt("id", nextCursor)
      .limit(5);
    if (probeError) throw new Error("无法读取音乐封面列表，请重试。");
    hasMore = (probeRows ?? []).some(
      (row) => row.type === "album" && typeof row.cover_url === "string" && isMzstaticCoverUrl(row.cover_url),
    );
  } else {
    hasMore = !exhausted && withArtists.length > 0;
  }

  return { items: withArtists, nextCursor, hasMore };
}

/** 按新规则重新解析一批条目；超过截止时间的条目标记 skipped。 */
export async function previewMusicCoverRematch(
  items: readonly RematchMusicItem[],
  deps: ResolveMusicCoverDeps & { deadlineAt?: number; now?: () => number } = {},
): Promise<PreviewRematchResult> {
  const batch = items.slice(0, REMATCH_BATCH_SIZE);
  const deadlineAt = deps.deadlineAt ?? Date.now() + REMATCH_PREVIEW_DEADLINE_MS;
  const now = deps.now ?? Date.now;

  const { results } = await mapWithConcurrencyUntilDeadline(
    batch,
    REMATCH_CONCURRENCY,
    deadlineAt,
    async (item) => {
      const newCover = await resolveMusicCover(
        {
          title: item.title,
          artist: item.artist,
          entity: "album",
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
        skipped: false,
      } satisfies RematchPreviewRow;
    },
    now,
  );

  const rows: RematchPreviewRow[] = [];
  for (let i = 0; i < batch.length; i += 1) {
    const done = results[i];
    if (done) {
      rows.push(done);
      continue;
    }
    const item = batch[i];
    rows.push({
      id: item.id,
      type: item.type,
      title: item.title,
      artist: item.artist,
      oldCover: item.cover_url,
      newCover: null,
      willChange: false,
      skipped: true,
    });
  }

  const skipped = rows.filter((row) => row.skipped).length;
  const processed = rows.filter((row) => !row.skipped);
  // 下一批 .gt(nextCursor)：有跳过时游标落在最后已处理条，使跳过条重新进入下一批；
  // 若本批一个都没处理完，由调用方沿用入参 afterId。
  const nextCursor = processed.length > 0 ? processed[processed.length - 1].id : null;

  return {
    rows,
    nextCursor,
    hasMore: skipped > 0,
    skipped,
  };
}

/**
 * 仅更新勾选条目的 cover_url。
 * 乐观锁：当前 cover_url 必须仍等于 expected_cover_url，否则计为 conflicted。
 */
export async function applyMusicCoverRematch(
  db: SupabaseClient,
  updates: readonly RematchApplyItem[],
): Promise<RematchApplyResult> {
  const batch = updates.slice(0, REMATCH_BATCH_SIZE);
  const ids = batch.map((row) => row.id).filter(isMediaId);
  if (ids.length === 0) {
    return { succeeded: 0, failed: batch.length, cleared: 0, conflicted: 0, conflictIds: [], succeededIds: [] };
  }

  const { data: existing, error } = await db
    .from("media_items")
    .select("id,type,cover_url")
    .in("id", ids)
    .eq("type", "album");

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
  let conflicted = 0;
  const conflictIds: string[] = [];
  const succeededIds: string[] = [];
  const touched: string[] = [];

  for (const update of batch) {
    if (!isMediaId(update.id) || !isMzstaticCoverUrl(update.expected_cover_url)) {
      failed += 1;
      continue;
    }
    const current = byId.get(update.id);
    if (!current || current.type !== "album") {
      failed += 1;
      continue;
    }
    if (!isMzstaticCoverUrl(current.cover_url)) {
      failed += 1;
      continue;
    }
    if (current.cover_url !== update.expected_cover_url) {
      conflicted += 1;
      conflictIds.push(update.id);
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
      .eq("cover_url", update.expected_cover_url)
      .eq("type", "album")
      .select("id");

    if (writeError) {
      failed += 1;
      continue;
    }
    if (!data?.length) {
      // 并发下封面已被改走。
      conflicted += 1;
      conflictIds.push(update.id);
      continue;
    }
    succeeded += 1;
    if (!nextCover) cleared += 1;
    touched.push(update.id);
    succeededIds.push(update.id);
  }

  if (touched.length > 0) {
    revalidateMediaItems(await affectedMediaIds(db, touched));
  }

  return { succeeded, failed, cleared, conflicted, conflictIds, succeededIds };
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

/** 解析提交的勾选更新：须带 expected_cover_url 做乐观锁。 */
export function parseRematchApplyPayload(raw: unknown): RematchApplyItem[] {
  if (!Array.isArray(raw)) return [];
  const items: RematchApplyItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const id = String((row as { id?: unknown }).id ?? "");
    if (!isMediaId(id)) continue;
    const expected = (row as { expected_cover_url?: unknown }).expected_cover_url;
    if (typeof expected !== "string" || !isMzstaticCoverUrl(expected)) continue;
    const coverRaw = (row as { cover_url?: unknown }).cover_url;
    if (coverRaw == null || coverRaw === "") {
      items.push({ id, cover_url: null, expected_cover_url: expected });
      continue;
    }
    if (typeof coverRaw !== "string") continue;
    if (!isAllowedRematchCover(coverRaw)) continue;
    items.push({ id, cover_url: coverRaw, expected_cover_url: expected });
  }
  return items.slice(0, REMATCH_BATCH_SIZE);
}

/** 有新图（非清空）的预览行，供「全选有新图」使用。 */
export function rowsWithNewCover(rows: readonly RematchPreviewRow[]): RematchPreviewRow[] {
  return rows.filter((row) => !row.skipped && row.willChange && Boolean(row.newCover));
}
