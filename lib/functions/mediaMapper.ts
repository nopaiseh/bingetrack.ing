import { Media } from "@/lib/types/Media";

export type MediaType = "movies" | "series";

export type SupabaseMediaItem = {
  id: string;
  title?: string;
  release_date?: string;
  release_years?: number | string;
  release_year_range?: string;
  runtime?: number | null;
  type?: string;
  summary?: string;
  cover_url?: string;
  average_rating?: number | null;
  rating?: number | null;
  status?: string;
  calculated_status?: string;
  tracking?: Array<{ status?: string; rating?: number | null }>;
  media_genres?: Array<{ genres: { name?: string } }>;
  media_languages?: Array<{ languages: { name?: string } }>;
  media_regions?: Array<{ regions: { name?: string } }>;
  media_series?: Array<{ name?: string }> | { name?: string };
  media_credits?: Array<{ people?: { name?: string }; role?: string; credit_order?: number | null }>;
  genres?: string[];
  languages?: string[];
  regions?: string[];
  season_number?: number;
};

function hasNameField(value: unknown): value is { name?: unknown } {
  return typeof value === "object" && value !== null && "name" in value;
}

function flattenRelationNames(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap(flattenRelationNames);
  }
  if (hasNameField(value) && typeof value.name === "string") {
    return [value.name];
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(flattenRelationNames);
  }
  return [];
}

function formatCredits(
  credits: SupabaseMediaItem["media_credits"],
  role: string,
): string[] {
  return (credits ?? [])
    .filter((credit) => credit.role === role)
    .sort((a, b) => (a.credit_order ?? 0) - (b.credit_order ?? 0))
    .map((credit) => credit.people?.name)
    .filter((name): name is string => typeof name === "string");
}

function parseSeriesName(value: SupabaseMediaItem["media_series"]): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value[0]?.name ?? null;
  }
  return value.name ?? null;
}

export function mapSupabaseToMedia(
  item: SupabaseMediaItem,
  mediaType: MediaType,
): Media {
  const genres = Array.isArray(item.genres)
    ? item.genres.filter((name): name is string => typeof name === "string")
    : flattenRelationNames(item.media_genres);

  const languages = Array.isArray(item.languages)
    ? item.languages.filter((name): name is string => typeof name === "string")
    : flattenRelationNames(item.media_languages);

  const regions = Array.isArray(item.regions)
    ? item.regions.filter((name): name is string => typeof name === "string")
    : flattenRelationNames(item.media_regions);

  return {
    id: String(item.id),
    title: item.title ?? "",
    date:
      item.release_year_range != null
        ? String(item.release_year_range)
        :
      item.release_years != null
        ? String(item.release_years)
        : item.release_date ?? "",
    runtime: item.runtime ?? null,
    rating:
      item.average_rating ?? item.rating ?? item.tracking?.[0]?.rating ?? null,
    genres,
    languages,
    regions,
    series: parseSeriesName(item.media_series),
    status:
      item.calculated_status ?? item.status ?? item.tracking?.[0]?.status ?? "",
    summary: item.summary ?? "",
    cover_url: item.cover_url ?? "",
    casts: formatCredits(item.media_credits, "actor"),
    directors: formatCredits(item.media_credits, "director"),
    type: mediaType,
  };
}
