import type { Metadata } from "next";
import type { Media } from "@/lib/types";
import type { SeasonInfo } from "@/lib/types";
import { SITE_URL } from "@/lib/site";

const DESCRIPTION_LENGTH = 160;

export function getMediaDescription(media: Media): string {
  const fallback = media.type === "series"
    ? `查看《${media.title}》的季度、剧集与观看记录。`
    : `查看《${media.title}》的观看记录与详细信息。`;
  const summary = media.summary?.trim();
  return summary ? summary.slice(0, DESCRIPTION_LENGTH) : fallback;
}

export function getMediaPath(media: Media): string {
  const section = media.type === "series" ? "series" : "movies";
  return `/${section}/${encodeURIComponent(media.id)}`;
}

export function buildMediaMetadata(media: Media): Metadata {
  const description = getMediaDescription(media);
  const path = getMediaPath(media);
  const images = media.cover_url
    ? [{ url: media.cover_url, alt: `${media.title} 海报` }]
    : [{ url: "/opengraph-image", alt: "bingetrack.ing 个人媒体记录平台" }];

  return {
    title: media.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      title: media.title,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: media.title,
      description,
      images: images?.map((image) => image.url),
    },
  };
}

export function buildMediaJsonLd(media: Media): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": media.type === "series" ? "TVSeries" : "Movie",
    name: media.title,
    url: `${SITE_URL}${getMediaPath(media)}`,
    description: getMediaDescription(media),
  };

  if (media.alternate_title) jsonLd.alternateName = media.alternate_title;
  if (media.cover_url) jsonLd.image = media.cover_url;
  if (media.date) jsonLd.datePublished = media.date;
  if (media.genres.length > 0) jsonLd.genre = media.genres;
  if (media.languages.length > 0) jsonLd.inLanguage = media.languages;
  if (media.regions?.length) jsonLd.countryOfOrigin = media.regions.map((name) => ({ "@type": "Country", name }));
  if (media.directors?.length) jsonLd.director = media.directors.map((name) => ({ "@type": "Person", name }));
  if (media.casts?.length) jsonLd.actor = media.casts.map((name) => ({ "@type": "Person", name }));
  if (media.runtime && media.runtime > 0) jsonLd.duration = `PT${media.runtime}M`;

  return jsonLd;
}

export function buildSeasonMetadata(series: Media, season: SeasonInfo): Metadata {
  const path = `/series/${encodeURIComponent(series.id)}/seasons/${encodeURIComponent(season.id)}`;
  const description = season.summary?.trim().slice(0, DESCRIPTION_LENGTH)
    || `查看《${series.title}》${season.title}的剧集与观看记录。`;
  const image = season.coverUrl || series.cover_url || "/opengraph-image";

  return {
    title: `${series.title} · ${season.title}`,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      title: `${series.title} · ${season.title}`,
      description,
      images: [{ url: image, alt: `${series.title} ${season.title} 海报` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${series.title} · ${season.title}`,
      description,
      images: [image],
    },
  };
}

export function serializeJsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
