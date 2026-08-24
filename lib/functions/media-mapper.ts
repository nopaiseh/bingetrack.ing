import { Media, ViewAllMediaRow } from "@/lib/types";

/**
 * Maps a flat row from the `v_all_media` view to the frontend `Media` object.
 */
export function mapViewRowToMedia(
  item: ViewAllMediaRow,
  overrideSeries?: string | null,
  overrideType?: "movies" | "series",
): Media {
  const mediaType: "movies" | "series" =
    overrideType ??
    (item.type === "movie" || item.type === "movies" ? "movies" : "series");

  return {
    id: String(item.id),
    title: item.title ?? "",
    date: String(item.sort_date ?? item.release_year ?? item.release_date ?? ""),
    release_year: item.release_year ?? "",
    runtime: item.runtime ?? null,
    rating: item.rating ?? item.average_rating ?? null,
    genres: item.genres ?? [],
    languages: item.languages ?? [],
    regions: item.regions ?? [],
    status: item.status || undefined,
    summary: item.summary ?? "",
    cover_url: item.cover_url ?? "",
    casts: item.casts ?? [],
    directors: item.directors ?? [],
    type: mediaType,
    series: overrideSeries !== undefined ? overrideSeries : (item.series ?? null),
  };
}
