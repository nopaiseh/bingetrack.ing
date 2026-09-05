import type { MediaCard, Media, ViewAllMediaRow } from "@/lib/types";

const nameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function sortNames(names: string[] | null | undefined): string[] {
  return [...(names ?? [])].sort(nameCollator.compare);
}

/**
 * Maps a flat row from the `v_all_media` view to the frontend `Media` object.
 */
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

/** Explicitly excludes detail-only data from card/API/RSC payloads. */
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
