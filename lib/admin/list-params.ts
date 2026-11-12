import { isMediaId } from "@/lib/functions/media-id";

/** 管理列表校验失败。消息不含 SQL，调用方可以直接展示。 */
export class AdminInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminInputError";
  }
}

/** 与现有管理列表一致的默认页大小。超过上限时截断，不拒绝整次请求。 */
export const ADMIN_LIST_DEFAULT_PAGE_SIZE = 25;
export const ADMIN_LIST_MAX_PAGE_SIZE = 100;
export const ADMIN_LIST_MAX_PAGE = 100_000;
export const ADMIN_LIST_MAX_QUERY_LENGTH = 200;
/** 一次批量操作最多接受的原始 ID 个数（去重前）。 */
export const ADMIN_BULK_MAX_IDS = 100;

export const sortDirections = ["asc", "desc"] as const;
export type SortDirection = (typeof sortDirections)[number];

/** 键是白名单排序字段，值是未指定方向时的默认方向。 */
export const peopleSorts = {
  name: "asc",
  alternate_name: "asc",
} as const satisfies Record<string, SortDirection>;
export type PeopleSortKey = keyof typeof peopleSorts;

export const mediaSorts = {
  date: "desc",
  title: "asc",
  rating: "desc",
} as const satisfies Record<string, SortDirection>;
export type MediaSortKey = keyof typeof mediaSorts;

export const adminMediaListTypes = ["movie", "tv_show"] as const;
export type AdminMediaListType = (typeof adminMediaListTypes)[number];

/** 可以写入 tracking 的状态。watching 只由单集汇总产生，不能直接保存。 */
export const bulkStatuses = ["watched", "want_to_watch"] as const;
export type BulkStatus = (typeof bulkStatuses)[number];

export type AdminListInput = {
  page?: number | string | null;
  pageSize?: number | string | null;
  /** 人物匹配姓名与别名，影视匹配标题与副标题；大小写不敏感。空字符串表示不筛选。 */
  q?: string | null;
  sort?: string | null;
  direction?: string | null;
};

export type ParsedAdminListQuery<SortKey extends string> = {
  page: number;
  pageSize: number;
  q: string;
  sort: SortKey;
  direction: SortDirection;
};

export type AdminListPage<Item> = {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
};

export type BulkCounts = {
  succeeded: number;
  failed: number;
};

export type PersonListItem = {
  id: string;
  name: string;
  alternate_name: string | null;
  credit_count: number;
};

export type MediaListItem = {
  id: string;
  type: AdminMediaListType;
  title: string;
  alternate_title: string | null;
  cover_url: string | null;
  /** 电影为自身上映日期。电视节目通常为空，播出日期看 sort_date。 */
  release_date: string | null;
  /** 电影片长（分钟）。电视节目为空。 */
  runtime: number | null;
  /** 电影等于上映日期；电视节目为最近一集播出日期，与管理列表排序口径一致。 */
  sort_date: string | null;
  status: "watched" | "watching" | "want_to_watch";
  rating: number | null;
  season_count: number;
  episode_count: number;
};

function parseOptionalInteger(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    if (!value.trim()) return undefined;
    const parsed = Number(value.trim());
    if (!Number.isSafeInteger(parsed)) throw new AdminInputError(`${label}无效。`);
    return parsed;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  throw new AdminInputError(`${label}无效。`);
}

function parseQuery<Key extends string>(
  input: AdminListInput | null | undefined,
  sorts: Readonly<Record<Key, SortDirection>>,
  defaultSort: Key,
): ParsedAdminListQuery<Key> {
  const source = input ?? {};
  const page = parseOptionalInteger(source.page, "页码") ?? 1;
  if (page < 1 || page > ADMIN_LIST_MAX_PAGE) throw new AdminInputError("页码无效。");
  const requestedSize = parseOptionalInteger(source.pageSize, "每页条数") ?? ADMIN_LIST_DEFAULT_PAGE_SIZE;
  if (requestedSize < 1) throw new AdminInputError("每页条数无效。");
  const pageSize = Math.min(requestedSize, ADMIN_LIST_MAX_PAGE_SIZE);

  let q = "";
  if (source.q !== undefined && source.q !== null) {
    if (typeof source.q !== "string") throw new AdminInputError("搜索词无效。");
    q = source.q.trim();
    if (q.length > ADMIN_LIST_MAX_QUERY_LENGTH) throw new AdminInputError("搜索词过长。");
  }

  let sort = defaultSort;
  if (source.sort !== undefined && source.sort !== null && source.sort !== "") {
    if (typeof source.sort !== "string" || !Object.hasOwn(sorts, source.sort)) throw new AdminInputError("不支持的排序字段。");
    sort = source.sort as Key;
  }

  let direction: SortDirection = sorts[sort];
  if (source.direction !== undefined && source.direction !== null && source.direction !== "") {
    if (source.direction !== "asc" && source.direction !== "desc") throw new AdminInputError("不支持的排序方向。");
    direction = source.direction;
  }

  return { page, pageSize, q, sort, direction };
}

/** 人物列表参数。默认按姓名升序，每页 25 条。 */
export function parseAdminPeopleQuery(input?: AdminListInput | null) {
  return parseQuery(input, peopleSorts, "name");
}

/** 电影与电视节目列表参数。默认按播出／上映日期倒序，每页 25 条。 */
export function parseAdminMediaQuery(input?: AdminListInput | null) {
  return parseQuery(input, mediaSorts, "date");
}

/** 只接受电影或电视节目，避免批量操作落到季、单集或预留的音乐表。 */
export function parseAdminMediaListType(value: unknown): AdminMediaListType {
  if (value === "movie" || value === "tv_show") return value;
  throw new AdminInputError("只支持电影和电视节目。");
}

/**
 * 校验批量 ID：必须是非空数组，原始长度不超过 100，每一项都是 UUID。
 * 大小写不同的同一 ID 只保留一次，返回小写形式。成功数与失败数按去重后的个数计算。
 */
export function parseBulkIds(ids: unknown): string[] {
  if (!Array.isArray(ids) || ids.length === 0) throw new AdminInputError("请提供要处理的条目。");
  if (ids.length > ADMIN_BULK_MAX_IDS) throw new AdminInputError(`一次最多处理 ${ADMIN_BULK_MAX_IDS} 条。`);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    if (!isMediaId(id)) throw new AdminInputError("条目 ID 格式不正确。");
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(key);
  }
  return unique;
}

/** 拒绝 watching：数据库枚举只有 watched 与 want_to_watch。 */
export function parseBulkStatus(status: unknown): BulkStatus {
  if (status === "watched" || status === "want_to_watch") return status;
  throw new AdminInputError("观看状态只能是已看（watched）或想看（want_to_watch）。在看（watching）由单集汇总，不能直接写入。");
}
