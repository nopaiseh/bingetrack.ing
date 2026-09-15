"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MediaCard } from "@/lib/types";
import MediaRatingBadge from "./MediaRatingBadge";

interface SpotlightHeroProps {
  items: MediaCard[];
  yearLabel?: string;
}

/** 首页沉浸展台组件，全面对齐站内 surface-panel / surface-card 细腻毛玻璃质感，呈现焦点影片的海报、剧情简介与类型标签。 */
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
      className="surface-panel relative overflow-hidden rounded-3xl p-6 sm:p-8 lg:p-10 transition-all duration-500 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
    >
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          
          {/* 左侧：电影简介、类型标签与核心控制区 */}
          <div
            id="spotlight-panel"
            role="tabpanel"
            aria-labelledby={`spotlight-thumb-${activeIndex}`}
            className="flex flex-1 flex-col justify-between max-w-2xl"
          >
            <div>
              {/* 顶栏徽标 */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="surface-raised inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold tracking-wider text-amber-300 backdrop-blur-md shadow-[0_0_12px_rgba(251,191,36,0.25)]">
                  <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
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
                className="font-serif-movie text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] line-clamp-2"
                title={currentItem.title}
              >
                {currentItem.title}
              </h2>

              {/* 类型标签（Genre Tags）采用站内 surface-muted 毛玻璃徽标规范 */}
              {currentItem.genres && currentItem.genres.length > 0 && (
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  {currentItem.genres.map((genre) => (
                    <span
                      key={genre}
                      className="surface-muted inline-flex items-center rounded-md border border-white/15 px-2.5 py-1 text-xs font-medium text-white/80 backdrop-blur-md transition-all duration-300 hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-white"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* 真实剧情简介（Description） */}
              <div className="mt-4">
                {currentItem.summary ? (
                  <p className="text-sm sm:text-base leading-relaxed text-white/80 drop-shadow-sm line-clamp-3 sm:line-clamp-4">
                    {currentItem.summary}
                  </p>
                ) : (
                  <p className="text-sm sm:text-base leading-relaxed text-white/70 italic">
                    收录于影史与年度精选档案，点击下方按钮回顾完整剧照、演职员与详情。
                  </p>
                )}
              </div>

              {/* 评分品味胶囊 */}
              <div className="mt-5 flex items-center gap-4">
                <MediaRatingBadge rating={currentItem.rating} size="lg" showTier />
              </div>
            </div>

            {/* 行动呼吁按钮组：采用站内 surface-control 主题微光毛玻璃胶囊规范 */}
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                href={mediaPath}
                className="surface-control group inline-flex items-center gap-2 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-6 py-2.5 text-sm font-semibold text-white backdrop-blur-xl shadow-[0_4px_15px_var(--accent-glow-soft)] drop-shadow-[0_0_5px_var(--accent-glow)] transition-all duration-300 hover:border-[var(--accent)] hover:bg-[var(--accent-glow-soft)] hover:shadow-[0_4px_20px_var(--accent-glow)] hover:scale-105 active:scale-95"
              >
                <span>立即回顾</span>
                <span className="i-material-symbols-arrow-forward-rounded size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* 右侧：立体海报画框与 1+3 联动画卷 */}
          <div className="flex flex-col items-center gap-4 shrink-0 lg:max-w-xs w-full sm:w-auto">
            {/* 主展示海报立体框 */}
            <div className="relative group/poster">
              <Link
                href={mediaPath}
                aria-label={`查看《${currentItem.title}》详情`}
                className="surface-muted relative aspect-2/3 w-48 sm:w-56 block overflow-hidden rounded-2xl border border-white/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl ring-1 ring-white/10 transition-transform duration-500 hover:scale-103 hover:border-[var(--accent-border-hover)] hover:shadow-[0_25px_60px_var(--accent-glow)]"
              >
                {currentItem.cover_url ? (
                  <Image
                    src={currentItem.cover_url}
                    alt={currentItem.title}
                    fill
                    priority
                    fetchPriority="high"
                    className="object-cover transition-transform duration-700 ease-out group-hover/poster:scale-105"
                    sizes="(max-width: 639px) 192px, 224px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/30">
                    <span className="i-material-symbols-movie-rounded size-12" aria-hidden="true" />
                  </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/poster:opacity-100 transition-opacity duration-300" />
              </Link>
            </div>

            {/* 3~4 部精选画卷缩略条：采用 surface-overlay 浓缩毛玻璃浮层 */}
            {spotlightList.length > 1 && (
              <div
                role="tablist"
                aria-label="展台候选精选"
                className="surface-overlay flex items-center justify-center gap-2 rounded-2xl border border-white/15 p-2 backdrop-blur-2xl shadow-xl"
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
                      className={`group relative aspect-2/3 w-11 sm:w-12 overflow-hidden rounded-lg border backdrop-blur-md transition-all duration-300 cursor-pointer ${
                        isActive
                          ? "border-amber-400/80 scale-110 shadow-[0_0_12px_rgba(251,191,36,0.5)] ring-2 ring-amber-400/50"
                          : "border-white/10 opacity-55 hover:opacity-100 hover:scale-105 hover:border-white/30"
                      }`}
                    >
                      {media.cover_url ? (
                        <Image
                          src={media.cover_url}
                          alt=""
                          fill
                          loading="lazy"
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : (
                        <span className="i-material-symbols-image-outline-rounded size-4 text-white/30" />
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
