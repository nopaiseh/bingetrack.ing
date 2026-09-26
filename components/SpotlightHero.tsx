"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MediaCard } from "@/lib/types";
import MediaRatingBadge from "./MediaRatingBadge";
import MediaCardStatusBadge from "./MediaCardStatusBadge";

interface SpotlightHeroProps {
  items: MediaCard[];
  yearLabel?: string;
}

/** 首页沉浸展台组件：标题与简介直接压在主题极光底上，呈现焦点影片的海报、剧情简介与类型标签。 */
export default function SpotlightHero({ items, yearLabel }: SpotlightHeroProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!items || items.length === 0) {
    return null;
  }

  const spotlightList = items.slice(0, 4);
  const currentItem = spotlightList.find((item) => item.id === selectedId) ?? spotlightList[0];
  const activeIndex = spotlightList.findIndex((item) => item.id === currentItem.id);
  const releaseYear = currentItem.release_year || (currentItem.date ? currentItem.date.substring(0, 4) : "精选");
  const mediaPath = `/${currentItem.type || "movies"}/${currentItem.id}`;

  return (
    <section
      aria-label="焦点精选展台"
      className="px-1 py-4 sm:py-6 lg:py-8"
    >
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12 xl:gap-16">
          
          {/* 左侧：电影简介、类型标签与核心控制区 */}
          <div
            id="spotlight-panel"
            key={`panel-${currentItem.id}`}
            role="tabpanel"
            aria-labelledby={`spotlight-thumb-${activeIndex}`}
            className="animate-spotlight-fade flex flex-1 flex-col justify-between max-w-2xl w-full order-2 lg:order-1"
          >
            <div>
              {/* 顶栏徽标 */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold tracking-wider text-[var(--accent-light)] backdrop-blur-md">
                  <span className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                  {yearLabel && yearLabel !== "All Time" ? `${yearLabel} · 站长力荐` : "影史精选 · 站长力荐"}
                </span>
                <span className="text-xs font-mono text-white/70">{releaseYear}</span>
                {currentItem.languages && currentItem.languages.length > 0 && (
                  <span className="text-xs text-white/70">
                    {currentItem.languages.slice(0, 2).join(" / ")}
                  </span>
                )}
              </div>

              {/* 电影标题（艺术衬线体） */}
              <h2
                className="font-serif-movie text-4xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight text-white drop-shadow-[0_2px_30px_rgba(0,0,0,0.45)] line-clamp-2"
                title={currentItem.title}
              >
                {currentItem.title}
              </h2>

              {/* 类型标签（Genre Tags）采用微透毛玻璃胶囊规范 */}
              {currentItem.genres && currentItem.genres.length > 0 && (
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  {currentItem.genres.map((genre) => (
                    <span
                      key={genre}
                      className="surface-inline inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white/85"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* 真实剧情简介（Description） */}
              <div className="mt-4">
                {currentItem.summary ? (
                  <p className="max-w-xl text-sm sm:text-base leading-relaxed text-white/80 line-clamp-2 sm:line-clamp-3 md:line-clamp-4 font-normal">
                    {currentItem.summary}
                  </p>
                ) : (
                  <p className="text-sm sm:text-base leading-relaxed text-white/70 italic">
                    收录于影史与年度精选档案，点击下方按钮查看完整剧照、演职员与详情。
                  </p>
                )}
              </div>

            </div>

            {/* 行动呼吁与评分品味胶囊 */}
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                href={mediaPath}
                className="button-accent group inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-bold active:scale-[0.98]"
              >
                <span>{currentItem.type === "series" ? "查看影剧" : "查看影片"}</span>
                <span className="i-material-symbols-arrow-forward-rounded size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
              <MediaRatingBadge rating={currentItem.rating} size="lg" showTier />
            </div>
          </div>

          {/* 右侧：立体海报画框与 1+3 联动画卷 */}
          <div className="flex flex-col items-center gap-5 shrink-0 lg:max-w-sm w-full sm:w-auto order-1 lg:order-2">
            {/* 主展示海报立体框 */}
            <div key={`poster-${currentItem.id}`} className="animate-spotlight-fade relative group/poster">
              <Link
                href={mediaPath}
                aria-label={`查看《${currentItem.title}》详情`}
                className="surface-card interactive-media-card relative aspect-2/3 w-48 sm:w-60 lg:w-72 block overflow-hidden rounded-3xl shadow-[0_50px_90px_-30px_rgba(0,0,0,0.9)]"
              >
                {currentItem.cover_url ? (
                  <Image
                    src={currentItem.cover_url}
                    alt={currentItem.title}
                    fill
                    priority
                    fetchPriority="high"
                    className="object-cover transition-transform duration-700 ease-out group-hover/poster:scale-105"
                    sizes="(max-width: 639px) 192px, (max-width: 1023px) 240px, 288px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/30">
                    <span className="i-material-symbols-movie-rounded size-12" aria-hidden="true" />
                  </div>
                )}
                <div className="absolute inset-0 bg-linear-to-br from-white/20 via-transparent to-transparent" aria-hidden="true" />
                <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/poster:opacity-100 transition-opacity duration-300" />
                <MediaCardStatusBadge status={currentItem.status} />
              </Link>
            </div>

            {/* 3~4 部精选画卷缩略条：采用 surface-overlay 浓缩毛玻璃浮层 */}
            {spotlightList.length > 1 && (
              <div
                role="tablist"
                aria-label="展台候选精选"
                className="surface-overlay flex items-center justify-center gap-2.5 rounded-2xl p-2.5 shadow-xl"
              >
                {spotlightList.map((media, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={media.id}
                      type="button"
                      role="tab"
                      id={`spotlight-thumb-${idx}`}
                      aria-selected={isActive}
                      aria-controls="spotlight-panel"
                      aria-label={`切换展台为 ${media.title}`}
                      onClick={() => setSelectedId(media.id)}
                      className={`group relative aspect-2/3 w-13 sm:w-14 overflow-hidden rounded-lg border backdrop-blur-md transition-all duration-300 cursor-pointer ${
                        isActive
                          ? "border-[var(--accent)] scale-105 -translate-y-1 shadow-lg shadow-black/60 ring-2 ring-[var(--accent-glow-soft)]"
                          : "border-white/10 opacity-60 hover:opacity-100 hover:-translate-y-1 hover:scale-105 hover:border-white/25"
                      }`}
                    >
                      {media.cover_url ? (
                        <Image
                          src={media.cover_url}
                          alt={`${media.title} 海报`}
                          fill
                          loading="lazy"
                          className="object-cover"
                          sizes="56px"
                        />
                      ) : (
                        <span className="i-material-symbols-image-outline-rounded size-4 text-white/30" />
                      )}
                      {isActive && (
                        <div className="absolute bottom-0 inset-x-1 h-0.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </section>
  );
}
