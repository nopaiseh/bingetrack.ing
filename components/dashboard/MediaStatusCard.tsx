"use client";

import Link from "next/link";
import AnimatedNumber from "@/components/AnimatedNumber";

/** 按传入标题和图标展示媒体部数，并用一行补充季数、集数；未传 details 时保留空行，让各看板卡片高度一致；提供 href 时作为可点击跳转卡片。 */
export default function MediaStatusCard({
  title,
  icon,
  toneClass,
  count,
  details,
  href,
}: {
  title: string;
  icon: string;
  toneClass: string;
  count: number;
  details?: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between text-sm font-semibold text-fg transition-colors group-hover:text-[var(--accent-hover)]">
        <div className="flex items-center gap-2.5">
          <span className={`${icon} size-4 inline-block ${toneClass} group-hover:text-[var(--accent-hover)]`} aria-hidden="true" />
          <span>{title}</span>
        </div>
        {href && (
          <span className="i-material-symbols-arrow-outward-rounded hidden size-3.5 text-fg-subtle sm:inline-block transition-all duration-200 group-hover:text-[var(--accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-3xl tracking-tight text-white sm:text-4xl">
          <AnimatedNumber value={count} />
        </span>
        <span className="text-sm text-fg-secondary">部</span>
      </div>
      <p className="flex items-center gap-1.5 font-mono text-xs text-fg-secondary" aria-hidden={details ? undefined : true}>
        <span>{details || " "}</span>
      </p>
    </>
  );

  const containerClasses = "surface-inline group flex min-w-0 flex-col gap-3 rounded-2xl p-3 sm:p-4 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.07]";

  if (href) {
    return (
      <Link
        href={href}
        className={`${containerClasses} cursor-pointer`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={containerClasses}>
      {content}
    </div>
  );
}
