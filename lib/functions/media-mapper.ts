import type { MediaCard, Media, ViewAllMediaRow } from "@/lib/types";

const nameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/** 复制名称数组后按忽略大小写的自然数字顺序排序，避免修改输入数组。 */
function sortNames(names: string[] | null | undefined): string[] {
  return [...(names ?? [])].sort(nameCollator.compare);
}

// 将数据库字段转换为详情对象，补齐空值、统一路由类型并排序分类名称。
export function mapViewRowToMedia(
  item: ViewAllMediaRow,
  overrideSeries?: string[] | null,
  overrideType?: "movies" | "series",
): Media {
  const mediaType: "movies" | "series" =
    overrideType ??
    (item.type === "movie" || item.type === "movies" ? "movies" : "series");

  return {
    id: String(item.id),
    title: item.title ?? "",
    alternate_title: item.alternate_title ?? null,
    date: String(item.sort_date ?? item.release_year ?? item.release_date ?? ""),
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
    directors: item.directors ?? [],
    type: mediaType,
    series: sortNames(overrideSeries ?? item.series),
  };
}

// 显式挑选列表字段，确保卡片、API 和服务端组件传输的数据不包含详情字段。
export function mapViewRowToMediaCard(item: ViewAllMediaRow): MediaCard {
  return {
    id: String(item.id),
    title: item.title ?? "",
    date: String(item.sort_date ?? item.release_year ?? item.release_date ?? ""),
    release_year: item.release_year ?? "",
    rating: item.rating ?? item.average_rating ?? null,
    genres: sortNames(item.genres),
    languages: sortNames(item.languages),
    cover_url: item.cover_url ?? "",
    type: item.type === "movie" || item.type === "movies" ? "movies" : "series",
  };
}
