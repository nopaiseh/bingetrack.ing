/** TMDB 图片 CDN 提供的宽度档位，从小到大排列；next.config.ts 的图片宽度列表与此保持一致。 */
export const TMDB_IMAGE_WIDTHS = [92, 154, 185, 342, 500, 780] as const;

export type TmdbImageSize = `w${(typeof TMDB_IMAGE_WIDTHS)[number]}`;

const TMDB_IMAGE_URL = /^(https:\/\/image\.tmdb\.org\/t\/p\/)[^/]+(\/.+)$/;

/** 把 TMDB 图片地址里的尺寸段换成指定档位；空值返回空字符串，非 TMDB 地址原样返回。 */
export function tmdbImageUrl(url: string | null | undefined, size: TmdbImageSize): string {
  if (!url) return "";
  return url.replace(TMDB_IMAGE_URL, `$1${size}$2`);
}

/** 选出不小于所需宽度的最小档位，超过最大档位时使用最大档位。 */
export function tmdbImageSizeForWidth(width: number): TmdbImageSize {
  const match = TMDB_IMAGE_WIDTHS.find(candidate => candidate >= width) ?? TMDB_IMAGE_WIDTHS[TMDB_IMAGE_WIDTHS.length - 1];
  return `w${match}`;
}
