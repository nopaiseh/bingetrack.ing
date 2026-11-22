"use client";

import HoverPrefetchLink from "@/components/HoverPrefetchLink";
import AnimatedNumber from "@/components/AnimatedNumber";

/** 按传入标题和图标展示媒体数量；量词默认「部」，音乐用「首」、图书用「本」。 */
export default function MediaStatusCard({
  title,
  icon,
  toneClass,
  count,
  unit = "部",
  details,
  href,
}: {
  title: string;
  icon: string;
  toneClass: string;
  count: number;
  unit?: "部" | "首" | "本" | "张";
  details?: string;
  href?: string;
}) {
  const safeCount = Number.isFinite(count) ? count : 0;
  const content = (
    <>
      <div className="flex items-center justify-between text-sm font-semibold text-fg transition-colors group-hover:text-[var(--accent-hover)]">
        <div className="flex items-center gap-2.5">
          <span
            className={`${icon} size-4 inline-block ${toneClass} group-hover:text-[var(--accent-hover)]`}
            aria-hidden="true"
          />
          <span>{title}</span>
        </div>
        {href && (
          <span
            className="i-material-symbols-arrow-outward-rounded hidden size-3.5 text-fg-subtle sm:inline-block transition-all duration-200 group-hover:text-[var(--accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-3xl tracking-tight text-white sm:text-4xl">
          <AnimatedNumber value={safeCount} />
        </span>
        <span className="text-sm text-fg-secondary">{unit}</span>
      </div>
      <p
        className="flex items-center gap-1.5 font-mono text-xs text-fg-secondary"
        aria-hidden={details ? undefined : true}
      >
        <span>{details || " "}</span>
      </p>
    </>
  );

  const containerClasses =
    "surface-inline group flex min-w-0 flex-col gap-3 rounded-2xl p-3 sm:p-4 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.07]";

  if (href) {
    return (
      <HoverPrefetchLink href={href} className={`${containerClasses} cursor-pointer`}>
        {content}
      </HoverPrefetchLink>
    );
  }

  return <div className={containerClasses}>{content}</div>;
}
