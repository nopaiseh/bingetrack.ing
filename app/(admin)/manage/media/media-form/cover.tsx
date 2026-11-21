"use client";

import { useState } from "react";
import LetterTile from "@/components/LetterTile";
import type { ManagedMediaType } from "@/lib/admin/media-form";

/** 影视路径补成 TMDB 原图；专辑／曲目只保留完整 HTTPS，不擅自加 TMDB 前缀。 */
export function normalizeCover(value: string, type: ManagedMediaType) {
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
  if (type === "album" || type === "music") return trimmed;
  return `https://image.tmdb.org/t/p/original/${trimmed.replace(/^\/+/, "")}`;
}

/** 预览只请求 TMDB 上的文件名。其它网站的地址和 javascript: 不进图片元素。 */
export function posterPreviewSrc(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !trimmed.startsWith("https://image.tmdb.org/t/p/")) return null;
  if (trimmed.startsWith("https://image.tmdb.org/t/p/")) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "https:" || url.hostname !== "image.tmdb.org" || url.username || url.password || url.port)
        return null;
      if (!url.pathname.startsWith("/t/p/")) return null;
    } catch {
      return null;
    }
  }
  const file = trimmed.split(/[?#]/)[0]?.split("/").pop() ?? "";
  if (!/^[A-Za-z0-9._~-]{1,200}$/.test(file)) return null;
  return `https://image.tmdb.org/t/p/w500/${encodeURIComponent(file)}`;
}

/**
 * 专辑封面允许 iTunes／CAA／archive／TMDB 的 HTTPS 地址预览。
 * 校验通过后返回 URL 对象规范化的 href，避免把原始输入直接塞进 img.src（CodeQL）。
 */
export function albumCoverPreviewSrc(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname;
    if (
      host === "image.tmdb.org" ||
      host === "coverartarchive.org" ||
      host === "archive.org" ||
      host.endsWith(".mzstatic.com") ||
      host.endsWith(".archive.org")
    )
      return url.href;
  } catch {
    return null;
  }
  return null;
}

export function PosterPreview({
  title,
  src,
  square = false,
  musicCover = false,
}: {
  title: string;
  src: string;
  square?: boolean;
  musicCover?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const preview = musicCover ? albumCoverPreviewSrc(src) : posterPreviewSrc(src);
  const showImage = Boolean(preview) && !failed;
  const emptyLabel = square ? "无封面" : "无海报";
  const tileTitle = title || (square ? "专" : "片");
  return (
    <div className={`edit-poster relative${square ? " edit-poster-square" : ""}`}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview ?? undefined} alt="封面预览" onError={() => setFailed(true)} />
      ) : (
        <>
          <LetterTile title={tileTitle} decorative className="absolute inset-0" />
          <span className="edit-poster-caption relative z-10">{emptyLabel}</span>
        </>
      )}
    </div>
  );
}
