"use client";

import { tmdbImageSizeForWidth, tmdbImageUrl } from "./tmdb-image";

/** next/image 的全局 loader：让浏览器直接向 TMDB CDN 请求最接近的尺寸档位，不经过 Vercel 图片优化。 */
export default function tmdbImageLoader({ src, width }: { src: string; width: number }): string {
  return tmdbImageUrl(src, tmdbImageSizeForWidth(width));
}
