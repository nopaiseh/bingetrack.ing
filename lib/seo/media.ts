import type { Metadata } from "next";
import type { Media } from "@/lib/types";
import type { SeasonInfo } from "@/lib/types";
import { SITE_URL } from "@/lib/site";
import { tmdbImageUrl } from "@/lib/tmdb-image";

// 分享描述按显示宽度截断：汉字等全角字符计 2，拉丁字符计 1，上限约等于 160 个拉丁字符，中文因此大约停在 80 字。
const DESCRIPTION_TARGET_WIDTH = 160;
// 中文句读更密，可以多往回找一个完整分句；英文尽量停在靠近上限的位置。
const CJK_BREAK_LOOKBACK = 40;
const LATIN_BREAK_LOOKBACK = 20;
const CJK_HEAVY_RATIO = 0.3;
const CLAUSE_PUNCTUATION = new Set("。！？；，、.!?;,");
// 分享卡片和结构化数据不经过 next/image，在这里固定海报尺寸，避免引用 TMDB 原图。
const SHARE_IMAGE_SIZE = "w500";

interface DescriptionUnit {
  char: string;
  width: number;
}

/** 判断码位是否为全角或中日韩字符，这些字符在摘要里按两个拉丁字符计宽。 */
function isWideCodePoint(code: number): boolean {
  return (code >= 0x1100 && code <= 0x115F)
    || (code >= 0x2329 && code <= 0x232A)
    || (code >= 0x2E80 && code <= 0x303E)
    || (code >= 0x3041 && code <= 0x33FF)
    || (code >= 0x3400 && code <= 0x4DBF)
    || (code >= 0x4E00 && code <= 0xA4CF)
    || (code >= 0xA960 && code <= 0xA97F)
    || (code >= 0xAC00 && code <= 0xD7A3)
    || (code >= 0xF900 && code <= 0xFAFF)
    || (code >= 0xFE10 && code <= 0xFE19)
    || (code >= 0xFE30 && code <= 0xFE6F)
    || (code >= 0xFF01 && code <= 0xFF60)
    || (code >= 0xFFE0 && code <= 0xFFE6)
    || (code >= 0x20000 && code <= 0x3FFFD);
}

/** 全角字符占比达到阈值时按中文简介处理，句读可以回退得更远。 */
function isCjkHeavy(units: DescriptionUnit[]): boolean {
  const visible = units.filter(/* 空白不参与占比，避免换行把中文简介误判成拉丁文本。 */ (unit) => !/\s/.test(unit.char));
  if (visible.length === 0) return false;
  const wide = visible.filter(/* 只统计显示宽度为 2 的字符。 */ (unit) => unit.width === 2).length;
  return wide / visible.length >= CJK_HEAVY_RATIO;
}

/** 句号、逗号等分句标点可以作为截断点；小数点和千分位逗号要保留。 */
function isClausePunctuation(units: DescriptionUnit[], index: number): boolean {
  const char = units[index]?.char;
  if (!char || !CLAUSE_PUNCTUATION.has(char)) return false;
  if (char !== "." && char !== ",") return true;
  const prev = units[index - 1]?.char ?? "";
  const next = units[index + 1]?.char ?? "";
  return !(/\d/.test(prev) && /\d/.test(next));
}

/** 在上限之前寻找最近的句读，没有则退到单词边界，最后才按宽度硬切。 */
function findDescriptionCut(units: DescriptionUnit[], end: number): number {
  const lookback = isCjkHeavy(units) ? CJK_BREAK_LOOKBACK : LATIN_BREAK_LOOKBACK;
  const earliest = Math.max(0, end - lookback);

  for (let index = end - 1; index >= earliest; index -= 1) {
    if (isClausePunctuation(units, index)) return index + 1;
  }
  for (let index = end - 1; index >= earliest; index -= 1) {
    if (/\s/.test(units[index]?.char ?? "")) return index;
  }
  return end;
}

/**
 * 把简介收成适合 meta、Open Graph 和 Twitter 的长度。
 * 未超出显示宽度时原样返回；超出时停在上限前较近的句读处，只在确实截断时补省略号。
 */
export function truncateMetaDescription(input: string): string {
  const text = input.trim().replace(/\s+/g, " ");
  if (!text) return "";

  const units = [...text].map(/* 逐个码位记录字符和显示宽度，避免把增补汉字拆成代理项。 */ (char) => ({
    char,
    width: isWideCodePoint(char.codePointAt(0) ?? 0) ? 2 : 1,
  }));

  let used = 0;
  let end = units.length;
  for (let index = 0; index < units.length; index += 1) {
    const width = units[index]?.width ?? 1;
    if (used + width > DESCRIPTION_TARGET_WIDTH) {
      end = index;
      break;
    }
    used += width;
  }
  if (end === units.length) return text;

  const kept = units.slice(0, findDescriptionCut(units, end)).map(/* 拼回截断点之前的字符。 */ (unit) => unit.char).join("").trimEnd();
  return `${kept}…`;
}

/** 修剪并按显示宽度截取媒体简介，缺少简介时按电影或电视节目生成默认描述。 */
export function getMediaDescription(media: Media): string {
  const fallback = media.type === "shows"
    ? `查看《${media.title}》的季度、单集与观看记录。`
    : `查看《${media.title}》的观看记录与详细信息。`;
  const summary = media.summary?.trim();
  return truncateMetaDescription(summary || fallback);
}

/** 按媒体类型选取详情栏目，并对媒体 ID 编码形成规范路径。 */
function getMediaPath(media: Media): string {
  const section = media.type === "shows" ? "shows" : "movies";
  return `/${section}/${encodeURIComponent(media.id)}`;
}

/** 生成媒体标题、描述、规范地址和社交分享元数据，无海报时使用站点默认图片。 */
export function buildMediaMetadata(media: Media): Metadata {
  const description = getMediaDescription(media);
  const path = getMediaPath(media);
  const images = media.cover_url
    ? [{ url: tmdbImageUrl(media.cover_url, SHARE_IMAGE_SIZE), alt: `${media.title} 海报` }]
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

/** 按电影或电视节目生成 JSON-LD，并仅在存在数据时补充人员、产地、语言和时长等字段。 */
export function buildMediaJsonLd(media: Media): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": media.type === "shows" ? "TVSeries" : "Movie",
    name: media.title,
    url: `${SITE_URL}${getMediaPath(media)}`,
    description: getMediaDescription(media),
  };

  if (media.alternate_title) jsonLd.alternateName = media.alternate_title;
  if (media.cover_url) jsonLd.image = tmdbImageUrl(media.cover_url, SHARE_IMAGE_SIZE);
  if (media.date) jsonLd.datePublished = media.date;
  if (media.genres.length > 0) jsonLd.genre = media.genres;
  if (media.languages.length > 0) jsonLd.inLanguage = media.languages;
  if (media.regions?.length) jsonLd.countryOfOrigin = media.regions.map(/* 将地区名称包装为结构化数据中的 Country 对象。 */ (name) => ({ "@type": "Country", name }));
  if (media.directors?.length) jsonLd.director = media.directors.map(/* 将导演姓名包装为结构化数据中的 Person 对象。 */ (name) => ({ "@type": "Person", name }));
  if (media.casts?.length) jsonLd.actor = media.casts.map(/* 将演员姓名包装为结构化数据中的 Person 对象。 */ (name) => ({ "@type": "Person", name }));
  if (media.runtime && media.runtime > 0) jsonLd.duration = `PT${media.runtime}M`;

  return jsonLd;
}

/** 生成季页面的规范地址与分享信息，图片依次回退到电视节目海报和站点默认图片。 */
export function buildSeasonMetadata(series: Media, season: SeasonInfo): Metadata {
  const path = `/shows/${encodeURIComponent(series.id)}/seasons/${encodeURIComponent(season.id)}`;
  const description = truncateMetaDescription(
    season.summary?.trim() || `查看《${series.title}》${season.title}的单集与观看记录。`,
  );
  const image = tmdbImageUrl(season.coverUrl || series.cover_url, SHARE_IMAGE_SIZE) || "/opengraph-image";

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
