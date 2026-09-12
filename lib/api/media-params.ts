import type { FetchMediaListOptions } from "@/lib/types";
import { MAX_SEARCH_QUERY_LENGTH } from "./search-limits";

export class ApiValidationError extends Error {
  /** 创建具名参数校验错误，供 API 区分客户端输入错误与服务端故障。 */
  constructor(message: string) {
    super(message);
    this.name = "ApiValidationError";
  }
}

const MEDIA_TYPES = new Set(["movie", "tv_series"]);
const CREDIT_ROLES = new Set(["director", "actor"]);
const STATUSES = new Set(["want_to_watch", "watching", "watched", "unwatched"]);
const SORTS = new Set(["date_asc", "date_desc", "rating_asc", "rating_desc"]);

// 拒绝非安全整数，并把合法数值限制在允许范围，约束分页请求大小。
function parseBoundedInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new ApiValidationError(`Invalid integer: ${value}`);
  return Math.min(max, Math.max(min, parsed));
}

/** 拆分并修剪逗号分隔列表，限制长度和项数，并在提供白名单时校验每项。 */
function parseList(
  value: string | null,
  name: string,
  allowed?: Set<string>,
): string | undefined {
  if (!value) return undefined;
  if (value.length > 200) throw new ApiValidationError(`${name} is too long`);
  const values = value.split(",").map(/* 去除列表项两端的空白。 */ (item) => item.trim()).filter(Boolean);
  if (values.length > 20) throw new ApiValidationError(`Too many ${name} values`);
  if (allowed && values.some(/* 检查是否存在不属于白名单的值。 */ (item) => !allowed.has(item))) {
    throw new ApiValidationError(`Invalid ${name}`);
  }
  return values.length > 0 ? values.join(",") : undefined;
}

/** 允许空年份，其他值必须为 1888 到当前 UTC 年份加五之间的四位年份。 */
function parseYear(value: string | null, name: string): string | undefined {
  if (!value) return undefined;
  const latestSupportedYear = new Date().getUTCFullYear() + 5;
  if (!/^\d{4}$/.test(value) || Number(value) < 1888 || Number(value) > latestSupportedYear) {
    throw new ApiValidationError(`Invalid ${name}`);
  }
  return value;
}

// 集中校验 API 筛选参数；保留合法搜索文本，表达式转义交给查询层处理。
export function parseMediaSearchParams(searchParams: URLSearchParams): FetchMediaListOptions {
  const q = searchParams.get("q")?.trim() || undefined;
  if (q && q.length > MAX_SEARCH_QUERY_LENGTH) throw new ApiValidationError("Search query is too long");

  const startYear = parseYear(searchParams.get("startYear"), "start year");
  const endYear = parseYear(searchParams.get("endYear"), "end year");
  if (startYear && endYear && startYear > endYear) {
    throw new ApiValidationError("Start year must not be after end year");
  }

  return {
    q,
    type: parseList(searchParams.get("type"), "media type", MEDIA_TYPES),
    seriesOnly: searchParams.get("series") === "true",
    creditRole: parseList(searchParams.get("creditRole"), "credit role", CREDIT_ROLES),
    status: parseList(searchParams.get("status"), "status", STATUSES),
    genre: parseList(searchParams.get("genre"), "genre"),
    region: parseList(searchParams.get("region"), "region"),
    language: parseList(searchParams.get("language"), "language"),
    startYear,
    endYear,
    sort: parseList(searchParams.get("sort"), "sort", SORTS),
    limit: parseBoundedInteger(searchParams.get("limit"), 30, 1, 100),
    offset: parseBoundedInteger(searchParams.get("offset"), 0, 0, 100_000),
  };
}

/** 只接受电影或电视剧榜单，校验可选年份并把返回条数限制在 1 到 20。 */
export function parseTopMediaParams(searchParams: URLSearchParams) {
  const type = searchParams.get("type");
  if (type !== "movie" && type !== "tv_series") {
    throw new ApiValidationError("Invalid media type");
  }

  const year = parseYear(searchParams.get("year"), "year") ?? null;
  const limit = parseBoundedInteger(searchParams.get("limit"), 10, 1, 20);
  return { type: type as "movie" | "tv_series", year, limit };
}
