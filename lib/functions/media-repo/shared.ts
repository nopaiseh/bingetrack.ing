import { getSupabasePublicServer } from "@/lib/supabase/public-server";
import type { MediaCard } from "@/lib/types";
import { normalizeDbErrorCause } from "@/lib/report-error";

// 统一为查询失败附加操作名称和原始错误，让页面区分加载失败与查无记录。
export class MediaRepositoryError extends Error {
  /** 失败的仓库操作名（如 fetch media list），供 Sentry 标注查询／视图。 */
  readonly operation: string;

  /** 创建包含操作名称和原始原因的仓库错误；PostgREST 对象会收成 Error 挂到 cause 上。 */
  constructor(operation: string, cause?: unknown) {
    super(`Media repository operation failed: ${operation}`, { cause: normalizeDbErrorCause(cause) });
    this.name = "MediaRepositoryError";
    this.operation = operation;
  }
}

// 列表只读取卡片需要的字段，避免把简介和演职员等详情数据传到客户端。
// 不选 authors：生产库在迁移落地前没有 v_all_media.authors，选它会让 /api/media 等公开接口 503。
// 详情仍走 select("*")；迁移前 authors 映射为空数组，迁移后自然带上。
export const MEDIA_CARD_COLUMNS =
  "id,type,title,sort_date,first_air_date,last_air_date,release_year,rating,genres,languages,cover_url,status,artists";
// 榜单精选读取卡片字段、简介摘要与 authors（v_all_media 自 books_backend／后续视图重建起已暴露该列）。
export const TOP_MEDIA_COLUMNS =
  "id,type,title,sort_date,first_air_date,last_air_date,release_year,rating,genres,languages,cover_url,status,summary,artists,authors";

// v_all_media 实际输出的观看／阅读状态。
export const WATCH_STATUSES = new Set(["want_to_watch", "watching", "watched", "in_progress"]);

/** 缺少任一端年份时返回 undefined，同年显示单年，跨年显示起止范围。 */
export function formatYearRange(first: number | null, last: number | null): string | undefined {
  if (first == null || last == null) return undefined;
  return first === last ? String(first) : `${first} - ${last}`;
}

// 关联结果可能是对象或数组，统一取首项，并将空关联转换为 undefined。
export function firstRelated<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

/** 用 v_media_series_years 为电视节目卡片补齐单集首末年份。查询失败一律抛出 MediaRepositoryError。 */
export async function addSeriesReleaseYearRanges<T extends MediaCard>(
  db: ReturnType<typeof getSupabasePublicServer>,
  items: T[],
): Promise<T[]> {
  const seriesIds = items
    .filter(/* 只保留电视节目条目以补充单集年份范围。 */ (item) => item.type === "shows")
    .map(/* 提取需要查询年份范围的电视节目 ID。 */ (item) => item.id);
  if (seriesIds.length === 0) return items;

  const { data, error } = await db
    .from("v_media_series_years")
    .select("series_id,first_year,last_year")
    .in("series_id", seriesIds);
  if (error) throw new MediaRepositoryError("fetch series year aggregates", error);
  const years = new Map(
    (data ?? []).map(
      /* 将电视节目 ID 与格式化后的首末年份组成查找表条目。 */ (row) => [
        row.series_id,
        formatYearRange(row.first_year, row.last_year),
      ],
    ),
  );
  return items.map(
    /* 用聚合年份覆盖显示年份，缺少聚合结果时保留原值。 */ (item) => ({
      ...item,
      release_year: years.get(item.id) ?? item.release_year,
    }),
  );
}
