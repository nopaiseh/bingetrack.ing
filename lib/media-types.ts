/**
 * 媒体类型的单一配置源。公开路由、管理端文案、封面比例、元数据字段与追踪状态文案都从这里派生。
 * 新增类型时优先改本文件；当前启用公开目录：电影、电视节目、专辑、图书。
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
  /** schema.org @type（JSON-LD）。 */
  schemaType: string;
  /** 缺少简介时的 SEO 描述模板；`{title}` 替换为作品名。 */
  defaultDescription: string;
  /** 是否对产品开放（目录、搜索、管理写入等）。 */
  enabled: boolean;
  /** 是否出现在管理端媒体表单／列表（子集于 enabled）。 */
  adminManaged: boolean;
  /**
   * 是否参与管理端顶层批量操作（listAdminMedia／bulk delete 等）。
   * 专辑与电影／电视节目同为顶层；曲目（music）挂在专辑下，不进顶层批量。
   */
  adminBulkOps: boolean;
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
    schemaType: "Movie",
    defaultDescription: "查看《{title}》的观看记录与详细信息。",
    enabled: true,
    adminManaged: true,
    adminBulkOps: true,
  },
  tv_show: {
    db: "tv_show",
    route: "shows",
    label: "电视节目",
    coverAspect: "2/3",
    metadataFields: MOVIE_TV_METADATA,
    trackingLabels: MOVIE_TV_TRACKING,
    schemaType: "TVSeries",
    defaultDescription: "查看《{title}》的季度、单集与观看记录。",
    enabled: true,
    adminManaged: true,
    adminBulkOps: true,
  },
  tv_season: {
    db: "tv_season",
    route: null,
    label: "季",
    coverAspect: "2/3",
    metadataFields: ["release_date", "summary"] as const satisfies readonly MediaMetadataField[],
    trackingLabels: MOVIE_TV_TRACKING,
    schemaType: "TVSeason",
    defaultDescription: "查看《{title}》的单集与观看记录。",
    enabled: true,
    adminManaged: true,
    adminBulkOps: false,
  },
  tv_episode: {
    db: "tv_episode",
    route: null,
    label: "单集",
    coverAspect: "2/3",
    metadataFields: ["release_date", "runtime", "rating", "summary"] as const satisfies readonly MediaMetadataField[],
    trackingLabels: MOVIE_TV_TRACKING,
    schemaType: "TVEpisode",
    defaultDescription: "查看《{title}》的观看记录与详细信息。",
    enabled: true,
    adminManaged: true,
    adminBulkOps: false,
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
    schemaType: "MusicRecording",
    defaultDescription: "查看《{title}》的收听记录与详细信息。",
    // 单曲暂无公开详情路由；管理端挂在专辑下编辑，搜索可展示类型标签。
    enabled: false,
    adminManaged: true,
    adminBulkOps: false,
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
    schemaType: "MusicAlbum",
    defaultDescription: "查看《{title}》的曲目与收听记录。",
    enabled: true,
    adminManaged: true,
    adminBulkOps: true,
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
    schemaType: "Book",
    defaultDescription: "查看《{title}》的阅读记录与详细信息。",
    enabled: true,
    adminManaged: true,
    adminBulkOps: true,
  },
} as const satisfies Record<DbMediaType, MediaTypeDefinition>;

export type MediaTypeKey = keyof typeof MEDIA_TYPE_DEFINITIONS;

/** 有公开顶层路由且当前启用的数据库类型（电影、电视节目、专辑、图书）。 */
export type CatalogDbMediaType = {
  [K in MediaTypeKey]: (typeof MEDIA_TYPE_DEFINITIONS)[K]["enabled"] extends true
    ? (typeof MEDIA_TYPE_DEFINITIONS)[K]["route"] extends string
      ? K
      : never
    : never;
}[MediaTypeKey];

/** 公开站点使用的路由段联合，当前为 "movies" | "shows" | "albums" | "books"。 */
export type PublicMediaType = {
  [K in CatalogDbMediaType]: (typeof MEDIA_TYPE_DEFINITIONS)[K]["route"];
}[CatalogDbMediaType];

/** 管理端可写入的媒体类型（电影／电视节目／季／单集／专辑／曲目／图书）。 */
export type ManagedMediaType = {
  [K in MediaTypeKey]: (typeof MEDIA_TYPE_DEFINITIONS)[K]["adminManaged"] extends true ? K : never;
}[MediaTypeKey];

/** 管理端顶层批量操作接受的类型（电影／电视节目／专辑／图书）。 */
export type AdminBulkMediaType = {
  [K in MediaTypeKey]: (typeof MEDIA_TYPE_DEFINITIONS)[K]["adminBulkOps"] extends true ? K : never;
}[MediaTypeKey];

/** @deprecated 使用 PublicMediaType；保留 MediaType 别名供现有类型文件引用。 */
export type MediaType = PublicMediaType;

const ALL_KEYS = Object.keys(MEDIA_TYPE_DEFINITIONS) as MediaTypeKey[];

/** 启用的目录类型（有公开路由）：movie、tv_show、album、book。 */
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

/** 管理列表顶层类型（不含季／集／曲目）：公开目录中且 adminManaged 的类型（电影、电视节目、专辑、图书）。 */
export const adminMediaListTypes = CATALOG_DB_TYPES.filter((key) => MEDIA_TYPE_DEFINITIONS[key].adminManaged);

/** 参与管理端批量操作的数据库类型。 */
export const ADMIN_BULK_DB_TYPES = ALL_KEYS.filter(
  (key): key is AdminBulkMediaType => MEDIA_TYPE_DEFINITIONS[key].adminBulkOps,
) as readonly AdminBulkMediaType[];

/** 启用类型的公开目录路径，如 /movies、/shows。 */
export const ENABLED_PUBLIC_CATALOG_PATHS = PUBLIC_MEDIA_TYPES.map((route) => `/${route}`);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 电视节目公开路由段（季页挂在其下）。 */
export const TV_SHOW_PUBLIC_ROUTE = MEDIA_TYPE_DEFINITIONS.tv_show.route as "shows";

/** 季详情路径正则：/shows/<showId>/seasons/<seasonId>。 */
export const PUBLIC_SEASON_PATH_PATTERN = new RegExp(`^/${escapeRegExp(TV_SHOW_PUBLIC_ROUTE)}/[^/]+/seasons/([^/]+)`);

/** 详情页路径正则：/movies|shows/<id>。 */
export const PUBLIC_DETAIL_PATH_PATTERN = new RegExp(`^/(?:${PUBLIC_MEDIA_TYPES.map(escapeRegExp).join("|")})/([^/]+)`);

const routeToDb = new Map<string, CatalogDbMediaType>(
  CATALOG_DB_TYPES.map((key) => [MEDIA_TYPE_DEFINITIONS[key].route as string, key]),
);

const dbToRoute = new Map<string, PublicMediaType>(
  CATALOG_DB_TYPES.map((key) => [key, MEDIA_TYPE_DEFINITIONS[key].route as PublicMediaType]),
);

const catalogDbTypeSet = new Set<string>(CATALOG_DB_TYPES);
const adminBulkDbTypeSet = new Set<string>(ADMIN_BULK_DB_TYPES);

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

/** 判断是否为管理端批量操作类型。 */
export function isAdminBulkMediaType(value: string): value is AdminBulkMediaType {
  return adminBulkDbTypeSet.has(value);
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
  const db = tryPublicRouteToDbType(route);
  if (!db) throw new Error(`Unknown public media route: ${route}`);
  return db;
}

/**
 * 安全地将公开路由段转为数据库类型。
 * 未启用或未知路由（含未来的 music／albums）返回 null，不抛错。
 */
export function tryPublicRouteToDbType(route: string | null | undefined): CatalogDbMediaType | null {
  if (!route) return null;
  return routeToDb.get(route) ?? null;
}

/** 读取类型定义；未知 key 返回 undefined。 */
export function getMediaTypeDefinition(key: string): MediaTypeDefinition | undefined {
  return isDbMediaType(key) ? MEDIA_TYPE_DEFINITIONS[key] : undefined;
}

/** 由公开路由或数据库类型解析定义；无法识别时回退到电视节目。 */
export function resolveMediaTypeDefinition(raw: string | null | undefined): MediaTypeDefinition {
  if (!raw) return MEDIA_TYPE_DEFINITIONS.tv_show;
  if (isPublicMediaType(raw)) return MEDIA_TYPE_DEFINITIONS[publicRouteToDbType(raw)];
  if (isDbMediaType(raw)) return MEDIA_TYPE_DEFINITIONS[raw];
  const fromDb = dbTypeToPublicRoute(raw);
  if (fromDb) return MEDIA_TYPE_DEFINITIONS[publicRouteToDbType(fromDb)];
  return MEDIA_TYPE_DEFINITIONS.tv_show;
}

/** schema.org @type。 */
export function mediaSchemaType(raw: string | null | undefined): string {
  return resolveMediaTypeDefinition(raw).schemaType;
}

/** 缺少简介时的默认 SEO 描述。 */
export function mediaDefaultDescription(title: string, raw: string | null | undefined): string {
  return resolveMediaTypeDefinition(raw).defaultDescription.replaceAll("{title}", title);
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

/** 管理端批量操作支持的中文标签列表（用于错误提示）。 */
export function adminBulkOpsLabelList(): string {
  return ADMIN_BULK_DB_TYPES.map((key) => MEDIA_TYPE_DEFINITIONS[key].label).join("和");
}
