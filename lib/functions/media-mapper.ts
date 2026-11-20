import type { MediaCard, Media, ViewAllMediaRow } from "@/lib/types";
import {
  dbTypeToPublicRoute,
  isDbMediaType,
  normalizeToPublicMediaType,
  type PublicMediaType,
} from "@/lib/media-types";

const nameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/** 复制名称数组后按忽略大小写的自然数字顺序排序，避免修改输入数组。 */
function sortNames(names: string[] | null | undefined): string[] {
  return [...(names ?? [])].sort(nameCollator.compare);
}

/**
 * 艺人按视图里的 credit_order 原序保留，不按姓名重排。
 * 演唱／专辑艺人的顺序有语义（主唱在前）。
 */
function artistsInOrder(names: string[] | null | undefined): string[] {
  return [...(names ?? [])].filter((name) => name.trim().length > 0);
}

/** 作者按 credit_order 原序保留。 */
function authorsInOrder(names: string[] | null | undefined): string[] {
  return artistsInOrder(names);
}

/** 公开详情路由段；未启用的 music 保留字面量供搜索标签使用，避免误链到影视页。 */
function cardPublicType(raw: string | null | undefined): MediaCard["type"] {
  if (!raw) return normalizeToPublicMediaType(raw);
  const route = dbTypeToPublicRoute(raw);
  if (route) return route;
  if (raw === "music") return "music";
  return normalizeToPublicMediaType(raw);
}

// 将数据库字段转换为详情对象，补齐空值、统一路由类型并排序分类名称。
export function mapViewRowToMedia(
  item: ViewAllMediaRow,
  overrideSeries?: string[] | null,
  overrideType?: PublicMediaType,
): Media {
  const mediaType = overrideType ?? normalizeToPublicMediaType(item.type);

  return {
    id: String(item.id),
    title: item.title ?? "",
    alternate_title: item.alternate_title ?? null,
    date: String(item.first_air_date ?? item.sort_date ?? item.release_year ?? item.release_date ?? ""),
    release_year: item.release_year ?? "",
    runtime: item.runtime ?? null,
    rating: item.rating ?? item.average_rating ?? null,
    genres: sortNames(item.genres),
    languages: sortNames(item.languages),
    regions: sortNames(item.regions),
    status: item.status || undefined,
    summary: item.summary ?? "",
    cover_url: item.cover_url ?? "",
    casts: item.casts ?? [],
    characters: item.characters ?? [],
    directors: item.directors ?? [],
    artists: artistsInOrder(item.artists),
    authors: authorsInOrder(item.authors),
    type: mediaType,
    series: sortNames(overrideSeries ?? item.series),
  };
}

// 显式挑选列表字段，确保卡片、API 和服务端组件传输的数据不包含详情字段。
export function mapViewRowToMediaCard(item: ViewAllMediaRow): MediaCard {
  const dbType = item.type != null && isDbMediaType(String(item.type)) ? String(item.type) : undefined;
  return {
    id: String(item.id),
    title: item.title ?? "",
    date: String(item.first_air_date ?? item.sort_date ?? item.release_year ?? item.release_date ?? ""),
    release_year: item.release_year ?? "",
    rating: item.rating ?? item.average_rating ?? null,
    genres: sortNames(item.genres),
    languages: sortNames(item.languages),
    cover_url: item.cover_url ?? "",
    status: item.status || undefined,
    artists: artistsInOrder(item.artists),
    authors: authorsInOrder(item.authors),
    type: cardPublicType(item.type),
    dbType,
  };
}
