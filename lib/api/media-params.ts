import type { FetchMediaListOptions } from "@/lib/types";

export class ApiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiValidationError";
  }
}

const MEDIA_TYPES = new Set(["movie", "tv_series"]);
const CREDIT_ROLES = new Set(["director", "actor"]);
const STATUSES = new Set(["want_to_watch", "watching", "watched", "unwatched"]);
const SORTS = new Set(["date_asc", "date_desc", "rating_asc", "rating_desc"]);

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

function parseList(
  value: string | null,
  name: string,
  allowed?: Set<string>,
): string | undefined {
  if (!value) return undefined;
  if (value.length > 200) throw new ApiValidationError(`${name} is too long`);
  const values = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (values.length > 20) throw new ApiValidationError(`Too many ${name} values`);
  if (allowed && values.some((item) => !allowed.has(item))) {
    throw new ApiValidationError(`Invalid ${name}`);
  }
  return values.length > 0 ? values.join(",") : undefined;
}

function parseYear(value: string | null, name: string): string | undefined {
  if (!value) return undefined;
  if (!/^\d{4}$/.test(value) || Number(value) < 1000 || Number(value) > 9998) {
    throw new ApiValidationError(`Invalid ${name}`);
  }
  return value;
}

export function parseMediaSearchParams(searchParams: URLSearchParams): FetchMediaListOptions {
  const q = searchParams.get("q")?.trim() || undefined;
  if (q && q.length > 100) throw new ApiValidationError("Search query is too long");

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

export function parseTopMediaParams(searchParams: URLSearchParams) {
  const type = searchParams.get("type");
  if (type !== "movie" && type !== "tv_series") {
    throw new ApiValidationError("Invalid media type");
  }

  const year = parseYear(searchParams.get("year"), "year") ?? null;
  const limit = parseBoundedInteger(searchParams.get("limit"), 10, 1, 20);
  return { type: type as "movie" | "tv_series", year, limit };
}
