import type { Metadata } from "next";
import type { Media } from "@/lib/types";
import type { SeasonInfo } from "@/lib/types";
import { SITE_URL } from "@/lib/site";

const DESCRIPTION_LENGTH = 160;

/** 修剪并截取媒体简介，缺少简介时按电影或电视剧生成默认描述。 */
export function getMediaDescription(media: Media): string {
  const fallback = media.type === "series"
    ? `查看《${media.title}》的季度、剧集与观看记录。`
    : `查看《${media.title}》的观看记录与详细信息。`;
  const summary = media.summary?.trim();
  return summary ? summary.slice(0, DESCRIPTION_LENGTH) : fallback;
}

/** 按媒体类型选取详情栏目，并对媒体 ID 编码形成规范路径。 */
export function getMediaPath(media: Media): string {
  const section = media.type === "series" ? "series" : "movies";
  return `/${section}/${encodeURIComponent(media.id)}`;
}

/** 生成媒体标题、描述、规范地址和社交分享元数据，无海报时使用站点默认图片。 */
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
      images: images?.map(/* 从分享图片对象提取 Twitter 所需的图片地址。 */ (image) => image.url),
    },
  };
}

/** 按电影或电视剧生成 JSON-LD，并仅在存在数据时补充人员、产地、语言和时长等字段。 */
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
  if (media.regions?.length) jsonLd.countryOfOrigin = media.regions.map(/* 将地区名称包装为结构化数据中的 Country 对象。 */ (name) => ({ "@type": "Country", name }));
  if (media.directors?.length) jsonLd.director = media.directors.map(/* 将导演姓名包装为结构化数据中的 Person 对象。 */ (name) => ({ "@type": "Person", name }));
  if (media.casts?.length) jsonLd.actor = media.casts.map(/* 将演员姓名包装为结构化数据中的 Person 对象。 */ (name) => ({ "@type": "Person", name }));
  if (media.runtime && media.runtime > 0) jsonLd.duration = `PT${media.runtime}M`;

  return jsonLd;
}

/** 生成季页面的规范地址与分享信息，图片依次回退到电视剧海报和站点默认图片。 */
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

/** 序列化 JSON-LD 并转义小于号，避免数据中的文本提前闭合脚本标签。 */
export function serializeJsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
