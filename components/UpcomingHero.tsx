"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import HoverPrefetchLink from "@/components/HoverPrefetchLink";
import LetterTile from "@/components/LetterTile";
import type { UpcomingRelease } from "@/lib/types";
import { daysUntil, pickUpcoming, sgtDateKey } from "@/lib/upcoming";

interface UpcomingHeroProps {
  items: UpcomingRelease[];
  // 服务端渲染当天的新加坡日期，作为水合前的“今天”；页面缓存跨过午夜时，水合后换成当前的新加坡日期。
  renderedOn?: string;
}

// 最多轮播十条，每条停留 30 秒；进度条动画结束即切到下一条。
const MAX_ITEMS = 10;
const ROTATE_SECONDS = 30;

const KIND_LABELS: Record<UpcomingRelease["kind"], { badge: string; verb: string; cta: string }> = {
  movie: { badge: "即将上映", verb: "上映", cta: "查看影片" },
  episode: { badge: "即将播出", verb: "播出", cta: "查看本季" },
};

/** 每分钟检查一次日期，并在页面重新可见时立即检查，让跨过午夜的页面自动刷新倒计时。 */
function subscribeToToday(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
}

/** 读取新加坡当天的日期键。 */
function getToday() {
  return sgtDateKey();
}

/** 订阅系统“减少动态效果”偏好。 */
function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

/** 读取系统是否要求减少动态效果；不支持 matchMedia 的环境视为不要求。 */
function getReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** 订阅标签页可见性变化。 */
function subscribeToVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** 读取当前标签页是否被隐藏。 */
function getHidden() {
  return document.hidden;
}

/** 将 YYYY-MM-DD 格式化为“10月9日 周五”，不在今年时补上年份。 */
function formatReleaseDate(releaseDate: string, today: string): string {
  const sameYear = releaseDate.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat("zh-CN", {
    ...(sameYear ? {} : { year: "numeric" }),
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${releaseDate}T00:00:00Z`));
}

/** 将剩余天数转换为展示文案：今天、明天或 N 天。 */
function countdownParts(days: number): { value: string; unit: string } {
  if (days <= 0) return { value: "今天", unit: "" };
  if (days === 1) return { value: "明天", unit: "" };
  return { value: String(days), unit: "天" };
}

/** 首页倒计时展台：全幅背景 + 左侧文案 + 右侧大海报；没有未来条目时整块隐藏。 */
export default function UpcomingHero({ items, renderedOn }: UpcomingHeroProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 用户手动暂停；悬停或键盘焦点停留在展台内时临时暂停。
  const [userPaused, setUserPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  // 记录触摸起点，用于手机上左右滑动切换。
  const touchStartX = useRef<number | null>(null);
  const today = useSyncExternalStore(subscribeToToday, getToday, () => renderedOn ?? getToday());
  const reducedMotion = useSyncExternalStore(subscribeToReducedMotion, getReducedMotion, () => false);
  const hidden = useSyncExternalStore(subscribeToVisibility, getHidden, () => false);

  const upcomingList = pickUpcoming(items ?? [], today, MAX_ITEMS);
  const currentItem = upcomingList.find((item) => item.id === selectedId) ?? upcomingList[0];
  const activeIndex = currentItem ? upcomingList.findIndex((item) => item.id === currentItem.id) : -1;

  if (!currentItem) {
    return null;
  }

  // 减少动态效果时不自动轮播；否则在用户暂停、交互中或标签页隐藏时停住进度条。
  const canRotate = upcomingList.length > 1 && !reducedMotion;
  const rotationPaused = userPaused || interacting || hidden;
  /** 按偏移量循环切换条目，首尾相接。 */
  const step = (offset: number) =>
    setSelectedId(upcomingList[(activeIndex + offset + upcomingList.length) % upcomingList.length].id);
  const hasMultiple = upcomingList.length > 1;
  const labels = KIND_LABELS[currentItem.kind];
  const days = daysUntil(currentItem.releaseDate, today);
  const countdown = countdownParts(days);
  const releaseDateLabel = formatReleaseDate(currentItem.releaseDate, today);
  // 首页数据未带 backdrop；有海报时用放大虚化海报作背景，否则用品红雾面。
  const hasCover = Boolean(currentItem.cover_url);
  // 仅首帧海报抢 LCP；背景装饰图不设 high priority。
  const prioritizePoster = activeIndex === 0;

  return (
    <section
      aria-label="即将上映倒计时"
      aria-roledescription="轮播"
      data-testid="upcoming-hero"
      className="upcoming-hero relative w-full overflow-hidden"
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteracting(false);
      }}
    >
      {/* 全幅装饰背景：虚化海报或品红雾面；不参与无障碍树。 */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {hasCover ? (
          <div
            key={`backdrop-${currentItem.id}`}
            className={`upcoming-hero-backdrop absolute inset-0 ${reducedMotion ? "" : "upcoming-hero-backdrop-motion"}`}
          >
            <Image
              src={currentItem.cover_url}
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-center"
              loading={prioritizePoster ? "eager" : "lazy"}
            />
          </div>
        ) : (
          <div key={`haze-${currentItem.id}`} className="upcoming-hero-haze absolute inset-0" />
        )}
        <div className="upcoming-hero-wash absolute inset-0" />
        <div className="upcoming-hero-fade absolute inset-0" />
      </div>

      <div className="relative z-10 container mx-auto max-w-7xl px-4 pb-8 pt-20 sm:px-6 sm:pb-10 sm:pt-22 lg:px-8 lg:pb-12 lg:pt-24">
        <div className="grid items-center gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10 xl:gap-14">
          {/* 左侧：倒计时、标题、类型标签与简介；宽度对齐站点内容栏。 */}
          <div
            id="upcoming-panel"
            key={`panel-${currentItem.id}`}
            role="group"
            aria-roledescription="条目"
            aria-label={hasMultiple ? `第 ${activeIndex + 1} 条，共 ${upcomingList.length} 条` : undefined}
            aria-live={canRotate && !rotationPaused ? "off" : "polite"}
            className="animate-spotlight-fade order-2 flex min-w-0 w-full max-w-xl flex-col justify-between sm:max-w-2xl lg:order-1 lg:max-w-[40rem]"
          >
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold tracking-wider text-[var(--accent-light)]">
                  <span className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                  {labels.badge}
                </span>
                <span className="text-xs font-mono text-fg-secondary">{releaseDateLabel}</span>
                {currentItem.languages.length > 0 && (
                  <span className="text-xs text-fg-secondary">{currentItem.languages.slice(0, 2).join(" / ")}</span>
                )}
              </div>

              <h2
                className="font-display line-clamp-2 text-balance text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl"
                title={currentItem.title}
              >
                {currentItem.title}
              </h2>

              {currentItem.subtitle && (
                <p className="mt-2 text-sm sm:text-base font-medium text-[var(--accent-light)] line-clamp-1">
                  {currentItem.subtitle}
                </p>
              )}

              {currentItem.genres.length > 0 && (
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  {currentItem.genres.map((genre) => (
                    <span
                      key={genre}
                      className="surface-inline inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-fg"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {currentItem.summary && (
                <div className="mt-4">
                  <p className="max-w-xl text-sm leading-relaxed text-fg-secondary line-clamp-3 sm:line-clamp-2 font-normal">
                    {currentItem.summary}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 sm:mt-6">
              <p className="flex items-baseline gap-2">
                <span className="sr-only">
                  {days <= 1 ? `${countdown.value}${labels.verb}` : `距${labels.verb}还有 ${days} 天`}
                </span>
                {days > 1 && (
                  <span className="text-sm text-fg-secondary" aria-hidden="true">
                    距{labels.verb}
                  </span>
                )}
                <span
                  className="font-mono text-4xl sm:text-5xl font-black tabular-nums leading-none text-white"
                  aria-hidden="true"
                >
                  {countdown.value}
                </span>
                <span className="text-sm text-fg-secondary" aria-hidden="true">
                  {countdown.unit || labels.verb}
                </span>
              </p>
              <HoverPrefetchLink
                href={currentItem.href}
                className="button-accent group inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-bold focus-ring active:scale-[0.98]"
              >
                <span>{labels.cta}</span>
                <span
                  className="i-material-symbols-arrow-forward-rounded size-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </HoverPrefetchLink>
            </div>
          </div>

          {/* 右侧大海报 + 轮播控件；窄屏居中叠在文案上方。 */}
          <div
            className="order-1 mx-auto flex w-[min(100%,13.5rem)] shrink-0 flex-col gap-3 sm:w-60 lg:order-2 lg:mx-0 lg:w-72 xl:w-80"
            onTouchStart={(event) => {
              touchStartX.current = event.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              const startX = touchStartX.current;
              touchStartX.current = null;
              const endX = event.changedTouches[0]?.clientX;
              if (!hasMultiple || startX == null || endX == null || Math.abs(endX - startX) < 50) return;
              step(endX < startX ? 1 : -1);
            }}
          >
            <div key={`poster-${currentItem.id}`} className="relative aspect-[2/3] w-full">
              <HoverPrefetchLink
                href={currentItem.href}
                aria-label={`查看《${currentItem.title}》详情`}
                className="group/poster upcoming-hero-poster relative block h-full w-full overflow-hidden rounded-2xl focus-ring"
              >
                {hasCover ? (
                  <Image
                    src={currentItem.cover_url}
                    alt=""
                    fill
                    preload={prioritizePoster}
                    fetchPriority={prioritizePoster ? "high" : "auto"}
                    className="object-cover"
                    sizes="(max-width: 640px) 216px, (max-width: 1024px) 240px, 320px"
                  />
                ) : (
                  <LetterTile title={currentItem.title} decorative className="h-full w-full rounded-2xl" />
                )}
              </HoverPrefetchLink>
              {hasMultiple && (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="上一条"
                    className="surface-panel absolute left-1.5 top-1/2 z-10 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-fg-secondary shadow-lg shadow-black/40 transition-all duration-200 hover:bg-white/15 hover:text-white focus-ring active:scale-95"
                  >
                    <span className="i-material-symbols-chevron-left-rounded size-6" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="下一条"
                    className="surface-panel absolute right-1.5 top-1/2 z-10 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-fg-secondary shadow-lg shadow-black/40 transition-all duration-200 hover:bg-white/15 hover:text-white focus-ring active:scale-95"
                  >
                    <span className="i-material-symbols-chevron-right-rounded size-6" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>

            {hasMultiple && (
              <div className="flex items-center justify-center gap-3">
                {canRotate && (
                  <button
                    type="button"
                    onClick={() => setUserPaused((paused) => !paused)}
                    aria-label={userPaused ? "继续自动切换" : "暂停自动切换"}
                    className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-fg-secondary transition-colors hover:bg-white/10 hover:text-white focus-ring"
                  >
                    <span
                      className={`${userPaused ? "i-material-symbols-play-arrow-rounded" : "i-material-symbols-pause-rounded"} size-5`}
                      aria-hidden="true"
                    />
                  </button>
                )}
                <div className="flex items-center gap-1.5">
                  {upcomingList.map((media, idx) => {
                    const isActive = idx === activeIndex;
                    const thumbDays = daysUntil(media.releaseDate, today);
                    const dayLabel = thumbDays <= 0 ? "今天" : thumbDays === 1 ? "明天" : `${thumbDays} 天`;
                    return (
                      <button
                        key={media.id}
                        type="button"
                        aria-label={`切换展台为 ${media.title}（${dayLabel}）`}
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => setSelectedId(media.id)}
                        className="group flex h-6 cursor-pointer items-center focus-ring rounded-sm"
                      >
                        <span
                          className={`relative block h-1 overflow-hidden rounded-full transition-all duration-300 group-hover:bg-white/40 ${isActive ? "bg-white/40" : "bg-white/20"} ${upcomingList.length > 6 ? "w-4 sm:w-6" : "w-6 sm:w-9"}`}
                        >
                          {isActive &&
                            (canRotate ? (
                              <span
                                key={`progress-${media.id}`}
                                data-testid="upcoming-progress"
                                className="animate-upcoming-progress absolute inset-y-0 left-0 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]"
                                style={{
                                  animationDuration: `${ROTATE_SECONDS}s`,
                                  animationPlayState: rotationPaused ? "paused" : "running",
                                }}
                                onAnimationEnd={() => step(1)}
                              />
                            ) : (
                              <span className="absolute inset-0 rounded-full bg-[var(--accent)]" />
                            ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
