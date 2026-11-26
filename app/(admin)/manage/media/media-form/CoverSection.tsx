"use client";

import { mediaTypes, type MediaInput, type ManagedMediaType } from "@/lib/admin/media-form";
import { normalizeCover, PosterPreview } from "./cover";

/** 侧栏封面／海报卡片（电影、电视节目、专辑、图书）。 */
export function CoverSection({
  type,
  item,
  coverUrl,
  titleValue,
  isAlbum,
  isBook,
  onCoverChange,
  onCoverBlur,
}: {
  type: ManagedMediaType;
  item?: MediaInput;
  coverUrl: string;
  titleValue: string;
  isAlbum: boolean;
  isBook: boolean;
  onCoverChange: (value: string) => void;
  onCoverBlur: (value: string) => void;
}) {
  return (
    <section className="edit-card edit-poster-card" aria-labelledby="edit-poster-heading">
      <header className="edit-card-head">
        <div>
          <h2 id="edit-poster-heading">{isAlbum ? "封面图片" : isBook ? "封面图片" : "海报与图片"}</h2>
          <p className="edit-hint">
            {isAlbum
              ? "专辑封面为正方形；无图时用色块首字"
              : isBook
                ? "图书封面为 2:3；无图时用色块首字"
                : "电影和电视节目保留海报与剧照；季和单集不设图片"}
          </p>
        </div>
      </header>
      <div className="edit-poster-row">
        <PosterPreview
          key={coverUrl}
          title={titleValue || item?.title || mediaTypes[type]}
          src={coverUrl}
          square={isAlbum}
          musicCover={isAlbum || isBook}
        />
        <div className="min-w-0">
          {normalizeCover(coverUrl, type) ? (
            <p className="edit-hint">
              {isAlbum || isBook ? "已填写封面地址，预览使用这张图片。" : "已填写海报地址，预览使用这张图片。"}
            </p>
          ) : (
            <p className="edit-hint">
              {isAlbum || isBook
                ? "无封面时的预览用标题首字和列表同款色块，公开页同样使用。"
                : "无海报时的预览用标题首字和列表同款色块，公开页同样使用。"}
            </p>
          )}
        </div>
      </div>
      {!isAlbum ? (
        <button type="button" onClick={() => document.getElementById("field-cover-url")?.focus()}>
          {isBook ? "粘贴封面地址" : "从 TMDB 加载海报"}
        </button>
      ) : null}
      <label htmlFor="field-cover-url" className="mb-1.5 mt-4">
        {isAlbum ? "封面图片 URL" : isBook ? "封面图片 URL" : "TMDB 海报路径"}
      </label>
      <input
        id="field-cover-url"
        name="cover_url"
        type="text"
        inputMode="url"
        value={coverUrl}
        onChange={(event) => onCoverChange(event.target.value)}
        onBlur={(event) => onCoverBlur(event.target.value)}
        maxLength={2000}
        placeholder={
          isAlbum
            ? "https://…（iTunes／CAA／TMDB）"
            : isBook
              ? "https://image.tmdb.org/t/p/original/…"
              : "https://image.tmdb.org/t/p/original/…"
        }
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
      />
      <p className="edit-hint">
        {isAlbum
          ? "粘贴完整 HTTPS 封面地址。留空时保存可能尝试自动匹配封面。"
          : isBook
            ? "粘贴完整 TMDB HTTPS 地址或文件路径。"
            : "粘贴完整网址或文件路径。路径会补成 TMDB 原图地址后再保存。"}
      </p>
      {isBook ? <p className="edit-hint mt-1">未填封面时，保存会按 ISBN 自动配封面；已填的封面不会被覆盖。</p> : null}
    </section>
  );
}
