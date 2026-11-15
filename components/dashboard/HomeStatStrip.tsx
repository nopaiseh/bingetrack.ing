"use client";

import AnimatedNumber from "@/components/AnimatedNumber";

/** 放映单下方的四格统计。手机两列，桌面一行四格。 */
export default function HomeStatStrip({
  runtimePercent,
  totalMovies,
  watchedMovies,
  unwatchedMovies,
  totalSeries,
  watchedSeries,
  watchingSeries,
  episodePercent,
  watchedEpisodes,
  totalEpisodes,
}: {
  runtimePercent: number;
  totalMovies: number;
  watchedMovies: number;
  unwatchedMovies: number;
  totalSeries: number;
  watchedSeries: number;
  watchingSeries: number;
  episodePercent: number;
  watchedEpisodes: number;
  totalEpisodes: number;
}) {
  return (
    <section aria-label="全时段统计" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <article className="surface-panel rounded-2xl border border-white/10 p-4">
        <h2 className="text-sm font-medium text-fg-secondary">完成进度</h2>
        <p className="mt-1 font-mono text-3xl leading-none text-[var(--accent-light)]">
          <AnimatedNumber value={runtimePercent} />%
        </p>
        <div
          className="progress-track mt-3 h-1.5 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-label={`完成进度 ${runtimePercent}%`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={runtimePercent}
        >
          <div className="progress-fill h-full rounded-full" style={{ width: `${runtimePercent}%` }} />
        </div>
      </article>
      <article className="surface-panel rounded-2xl border border-white/10 p-4">
        <h2 className="text-sm font-medium text-fg-secondary">电影</h2>
        <p className="mt-1 font-mono text-3xl leading-none text-white">
          <AnimatedNumber value={totalMovies} />
        </p>
        <p className="mt-2 text-sm text-fg-secondary">
          已看 {watchedMovies} · 想看 {unwatchedMovies}
        </p>
      </article>
      <article className="surface-panel rounded-2xl border border-white/10 p-4">
        <h2 className="text-sm font-medium text-fg-secondary">电视节目</h2>
        <p className="mt-1 font-mono text-3xl leading-none text-white">
          <AnimatedNumber value={totalSeries} />
        </p>
        <p className="mt-2 text-sm text-fg-secondary">
          已看 {watchedSeries} · 在看 {watchingSeries}
        </p>
      </article>
      <article className="surface-panel rounded-2xl border border-white/10 p-4">
        <h2 className="text-sm font-medium text-fg-secondary">单集进度</h2>
        <p className="mt-1 font-mono text-3xl leading-none text-white">
          <AnimatedNumber value={episodePercent} />%
        </p>
        <p className="mt-2 text-sm text-fg-secondary">
          {watchedEpisodes} / {totalEpisodes} 集
        </p>
      </article>
    </section>
  );
}
