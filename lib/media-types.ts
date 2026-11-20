/**
 * 媒体类型的单一配置源。公开路由、管理端文案、封面比例、元数据字段与追踪状态文案都从这里派生。
 * 新增类型时优先改本文件；仅 movie / TV 相关条目当前启用。
 */

/** 与 public.media_type 枚举对齐（含已改名的 tv_show）。 */
export type DbMediaType = "movie" | "tv_show" | "tv_season" | "tv_episode" | "music" | "album" | "book";

/** 封面宽高比：影视海报 2:3，音乐／专辑正方形 1:1。 */
export type CoverAspectRatio = "2/3" | "1/1";

/** 详情／卡片上可按类型开关的元数据字段。 */
export type MediaMetadataField =
  | "release_date"
  | "runtime"
  | "rating"
  | "genres"
  | "languages"
  | "regions"
  | "directors"
  | "casts"
  | "artists"
  | "authors"
  | "summary";

/** 追踪状态的中文动词（完成／想要）；在看等中间态仍由公开页的 WATCH_STATUSES 负责。 */
export type TrackingStatusLabels = {
  done: string;
  want: string;
};

export type MediaTypeDefinition = {
  /** 数据库 media_type 枚举值。 */
  db: DbMediaType;
  /** 公开详情／目录路由段；季／集挂在电视节目下，无独立顶层段。 */
  route: string | null;
  /** 中文展示名。 */
  label: string;
  coverAspect: CoverAspectRatio;
  metadataFields: readonly MediaMetadataField[];
  trackingLabels: TrackingStatusLabels;
  /** 是否对产品开放（目录、搜索、管理写入等）。 */
  enabled: boolean;
  /** 是否出现在管理端媒体表单／列表（子集于 enabled）。 */
  adminManaged: boolean;
};

const MOVIE_TV_METADATA = [
  "release_date",
  "runtime",
  "rating",
  "genres",
  "languages",
  "regions",
  "directors",
  "casts",
  "summary",
] as const satisfies readonly MediaMetadataField[];

const MOVIE_TV_TRACKING = { done: "看过", want: "想看" } as const satisfies TrackingStatusLabels;

export const MEDIA_TYPE_DEFINITIONS = {
  movie: {
    db: "movie",
    route: "movies",
    label: "电影",
    coverAspect: "2/3",
    metadataFields: MOVIE_TV_METADATA,
    trackingLabels: MOVIE_TV_TRACKING,
    enabled: true,
    adminManaged: true,
  },
  tv_show: {
    db: "tv_show",
    route: "shows",
    label: "电视节目",
    coverAspect: "2/3",
    metadataFields: MOVIE_TV_METADATA,
    trackingLabels: MOVIE_TV_TRACKING,
    enabled: true,
    adminManaged: true,
  },
  tv_season: {
    db: "tv_season",
    route: null,
    label: "季",
    coverAspect: "2/3",
    metadataFields: ["release_date", "summary"] as const satisfies readonly MediaMetadataField[],
    trackingLabels: MOVIE_TV_TRACKING,
    enabled: true,
    adminManaged: true,
  },
  tv_episode: {
    db: "tv_episode",
    route: null,
    label: "单集",
    coverAspect: "2/3",
    metadataFields: ["release_date", "runtime", "rating", "summary"] as const satisfies readonly MediaMetadataField[],
    trackingLabels: MOVIE_TV_TRACKING,
    enabled: true,
    adminManaged: true,
  },
  music: {
    db: "music",
    route: "music",
    label: "单曲",
    coverAspect: "1/1",
    metadataFields: [
      "release_date",
      "runtime",
      "rating",
      "genres",
      "artists",
      "summary",
    ] as const satisfies readonly MediaMetadataField[],
    trackingLabels: { done: "听过", want: "想听" },
    enabled: false,
    adminManaged: false,
  },
  album: {
    db: "album",
    route: "albums",
    label: "专辑",
    coverAspect: "1/1",
    metadataFields: [
      "release_date",
      "rating",
      "genres",
      "artists",
      "summary",
    ] as const satisfies readonly MediaMetadataField[],
    trackingLabels: { done: "听过", want: "想听" },
    enabled: false,
    adminManaged: false,
  },
  book: {
    db: "book",
    route: "books",
    label: "图书",
    coverAspect: "2/3",
    metadataFields: [
      "release_date",
      "rating",
      "genres",
      "languages",
      "authors",
      "summary",
    ] as const satisfies readonly MediaMetadataField[],
    trackingLabels: { done: "读过", want: "想读" },
    enabled: false,
    adminManaged: false,
  },
} as const satisfies Record<DbMediaType, MediaTypeDefinition>;

export type MediaTypeKey = keyof typeof MEDIA_TYPE_DEFINITIONS;

/** 有公开顶层路由且当前启用的数据库类型（电影、电视节目）。 */
export type CatalogDbMediaType = {
  [K in MediaTypeKey]: (typeof MEDIA_TYPE_DEFINITIONS)[K]["enabled"] extends true
    ? (typeof MEDIA_TYPE_DEFINITIONS)[K]["route"] extends string
      ? K
      : never
    : never;
}[MediaTypeKey];

/** 公开站点使用的路由段联合，当前为 "movies" | "shows"。 */
export type PublicMediaType = {
  [K in CatalogDbMediaType]: (typeof MEDIA_TYPE_DEFINITIONS)[K]["route"];
}[CatalogDbMediaType];

/** 管理端可写入的媒体类型（电影／电视节目／季／单集）。 */
export type ManagedMediaType = {
  [K in MediaTypeKey]: (typeof MEDIA_TYPE_DEFINITIONS)[K]["adminManaged"] extends true ? K : never;
}[MediaTypeKey];

/** @deprecated 使用 PublicMediaType；保留 MediaType 别名供现有类型文件引用。 */
export type MediaType = PublicMediaType;

const ALL_KEYS = Object.keys(MEDIA_TYPE_DEFINITIONS) as MediaTypeKey[];

/** 启用的目录类型（有公开路由）：movie、tv_show。 */
export const CATALOG_DB_TYPES = ALL_KEYS.filter(
  (key): key is CatalogDbMediaType => MEDIA_TYPE_DEFINITIONS[key].enabled && MEDIA_TYPE_DEFINITIONS[key].route != null,
) as readonly CatalogDbMediaType[];

/** 公开路由段列表，顺序与 CATALOG_DB_TYPES 一致。 */
export const PUBLIC_MEDIA_TYPES = CATALOG_DB_TYPES.map(
  (key) => MEDIA_TYPE_DEFINITIONS[key].route as PublicMediaType,
) as readonly PublicMediaType[];

/** 管理端表单／列表用的类型 → 中文标签（与历史 mediaTypes 对象一致）。 */
export const mediaTypes = Object.fromEntries(
  ALL_KEYS.filter((key) => MEDIA_TYPE_DEFINITIONS[key].adminManaged).map((key) => [
    key,
    MEDIA_TYPE_DEFINITIONS[key].label,
  ]),
) as { readonly [K in ManagedMediaType]: (typeof MEDIA_TYPE_DEFINITIONS)[K]["label"] };

/** 管理列表顶层类型（不含季／集），与历史 adminMediaListTypes 一致。 */
export const adminMediaListTypes = CATALOG_DB_TYPES;

/** 启用类型的公开目录路径，如 /movies、/shows。 */
export const ENABLED_PUBLIC_CATALOG_PATHS = PUBLIC_MEDIA_TYPES.map((route) => `/${route}`);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 详情页路径正则：/movies|shows/<id>。 */
export const PUBLIC_DETAIL_PATH_PATTERN = new RegExp(`^/(?:${PUBLIC_MEDIA_TYPES.map(escapeRegExp).join("|")})/([^/]+)`);

const routeToDb = new Map<string, CatalogDbMediaType>(
  CATALOG_DB_TYPES.map((key) => [MEDIA_TYPE_DEFINITIONS[key].route as string, key]),
);

const dbToRoute = new Map<string, PublicMediaType>(
  CATALOG_DB_TYPES.map((key) => [key, MEDIA_TYPE_DEFINITIONS[key].route as PublicMediaType]),
);

const catalogDbTypeSet = new Set<string>(CATALOG_DB_TYPES);

/** 判断是否为已知数据库媒体类型。 */
export function isDbMediaType(value: string): value is DbMediaType {
  return Object.hasOwn(MEDIA_TYPE_DEFINITIONS, value);
}

/** 判断是否为当前启用的目录数据库类型。 */
export function isCatalogDbMediaType(value: string): value is CatalogDbMediaType {
  return catalogDbTypeSet.has(value);
}

/** 判断是否为公开路由段（movies / shows）。 */
export function isPublicMediaType(value: string): value is PublicMediaType {
  return routeToDb.has(value);
}

/** 判断是否为管理端可管理类型。 */
export function isManagedMediaType(value: string): value is ManagedMediaType {
  return isDbMediaType(value) && MEDIA_TYPE_DEFINITIONS[value].adminManaged;
}

/** 数据库类型 → 公开路由段；非目录类型返回 null。 */
export function dbTypeToPublicRoute(dbType: string): PublicMediaType | null {
  return dbToRoute.get(dbType) ?? null;
}

/**
 * 将视图／API 中的 type 字段规范为公开路由段。
 * 接受 movie/movies、tv_show/shows；未知值回退为 shows（与历史 mapper 行为一致）。
 */
export function normalizeToPublicMediaType(raw: string | null | undefined): PublicMediaType {
  if (!raw) return "shows";
  if (isPublicMediaType(raw)) return raw;
  const fromDb = dbTypeToPublicRoute(raw);
  if (fromDb) return fromDb;
  return raw === "movie" || raw === "movies" ? "movies" : "shows";
}

/** 公开路由段 → 数据库类型。 */
export function publicRouteToDbType(route: PublicMediaType): CatalogDbMediaType {
  const db = routeToDb.get(route);
  if (!db) throw new Error(`Unknown public media route: ${route}`);
  return db;
}

/** 读取类型定义；未知 key 返回 undefined。 */
export function getMediaTypeDefinition(key: string): MediaTypeDefinition | undefined {
  return isDbMediaType(key) ? MEDIA_TYPE_DEFINITIONS[key] : undefined;
}

/** 公开路由段对应的中文标签。 */
export function publicMediaTypeLabel(route: PublicMediaType): string {
  return MEDIA_TYPE_DEFINITIONS[publicRouteToDbType(route)].label;
}

/** 目录详情路径：/movies/<id> 或 /shows/<id>。 */
export function publicMediaDetailPath(route: PublicMediaType, id: string): string {
  return `/${route}/${encodeURIComponent(id)}`;
}

/** 由数据库类型构造公开详情路径；无公开路由时返回 null。 */
export function publicPathForDbType(dbType: string, id: string): string | null {
  const route = dbTypeToPublicRoute(dbType);
  return route ? publicMediaDetailPath(route, id) : null;
}
