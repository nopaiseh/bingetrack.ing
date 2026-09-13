export interface RatingTierInfo {
  label: string;
  badgeClass: string;
  glowClass: string;
  textClass: string;
  icon: string;
  isMasterpiece?: boolean;
}

/** 按 10 级梯度推导评分的视觉体系、标签与光影配置。 */
export function getRatingTier(rating: number | null | undefined): RatingTierInfo {
  if (rating == null) {
    return {
      label: "未评分",
      badgeClass: "border-white/10 bg-white/5 text-white/50",
      glowClass: "",
      textClass: "text-white/50",
      icon: "i-material-symbols-star-outline-rounded",
    };
  }

  const num = Number(rating);
  if (num >= 9.0) {
    return {
      label: "神作",
      badgeClass: "border-amber-400/60 bg-linear-to-r from-amber-500/20 via-yellow-400/25 to-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.35)] ring-1 ring-amber-400/30",
      glowClass: "drop-shadow-[0_0_8px_rgba(251,191,36,0.8)] text-yellow-300",
      textClass: "text-amber-300 font-bold",
      icon: "i-material-symbols-stars-rounded",
      isMasterpiece: true,
    };
  }
  if (num >= 8.0) {
    return {
      label: "佳作",
      badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.2)]",
      glowClass: "drop-shadow-[0_0_5px_rgba(251,191,36,0.6)] text-amber-400",
      textClass: "text-amber-400 font-semibold",
      icon: "i-material-symbols-star-rounded",
    };
  }
  if (num >= 7.0) {
    return {
      label: "良作",
      badgeClass: "border-emerald-500/35 bg-emerald-500/15 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.15)]",
      glowClass: "drop-shadow-[0_0_5px_rgba(52,211,153,0.5)] text-emerald-400",
      textClass: "text-emerald-400 font-medium",
      icon: "i-material-symbols-star-rounded",
    };
  }
  if (num >= 6.0) {
    return {
      label: "尚可",
      badgeClass: "border-sky-500/30 bg-sky-500/15 text-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.15)]",
      glowClass: "drop-shadow-[0_0_5px_rgba(56,189,248,0.5)] text-sky-400",
      textClass: "text-sky-400 font-medium",
      icon: "i-material-symbols-star-rounded",
    };
  }
  if (num >= 5.0) {
    return {
      label: "及格",
      badgeClass: "border-zinc-400/30 bg-zinc-500/15 text-zinc-300",
      glowClass: "drop-shadow-[0_0_4px_rgba(255,255,255,0.2)] text-zinc-300",
      textClass: "text-zinc-300 font-medium",
      icon: "i-material-symbols-star-half-rounded",
    };
  }
  if (num >= 4.0) {
    return {
      label: "平庸",
      badgeClass: "border-stone-500/25 bg-stone-500/15 text-stone-400",
      glowClass: "text-stone-400",
      textClass: "text-stone-400",
      icon: "i-material-symbols-star-outline-rounded",
    };
  }
  if (num >= 3.0) {
    return {
      label: "较差",
      badgeClass: "border-purple-500/25 bg-purple-500/15 text-purple-400",
      glowClass: "text-purple-400",
      textClass: "text-purple-400",
      icon: "i-material-symbols-star-outline-rounded",
    };
  }
  if (num >= 2.0) {
    return {
      label: "烂片",
      badgeClass: "border-rose-500/35 bg-rose-500/15 text-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.15)]",
      glowClass: "drop-shadow-[0_0_5px_rgba(244,63,94,0.5)] text-rose-400",
      textClass: "text-rose-400",
      icon: "i-material-symbols-thumb-down-rounded",
    };
  }
  if (num >= 1.0) {
    return {
      label: "灾难",
      badgeClass: "border-red-600/45 bg-red-950/40 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.25)]",
      glowClass: "drop-shadow-[0_0_6px_rgba(239,68,68,0.7)] text-red-400",
      textClass: "text-red-400 font-bold",
      icon: "i-material-symbols-warning-rounded",
    };
  }
  // 0.0 ~ 0.9
  return {
    label: "神烂",
    badgeClass: "border-red-900/60 bg-black/70 text-red-500 shadow-[0_0_12px_rgba(185,28,28,0.3)]",
    glowClass: "drop-shadow-[0_0_6px_rgba(185,28,28,0.8)] text-red-500",
    textClass: "text-red-500 font-black",
    icon: "i-material-symbols-skull-rounded",
  };
}

interface MediaRatingBadgeProps {
  rating: number | null | undefined;
  size?: "sm" | "md" | "lg";
  showTier?: boolean;
  className?: string;
}

/** 呈现站长 10 级个性化品味梯度的影视评分胶囊。 */
export default function MediaRatingBadge({
  rating,
  size = "sm",
  showTier = true,
  className = "",
}: MediaRatingBadgeProps) {
  const tier = getRatingTier(rating);

  if (rating == null) {
    const unratedPad = size === "lg" ? "px-2 py-0.5 text-xs" : size === "md" ? "px-1.5 py-0.5 text-xs" : "px-1 py-0.5 text-[10px]";
    return (
      <span
        className={`inline-flex shrink-0 items-center rounded border border-white/10 ${unratedPad} font-medium leading-none text-white/50 backdrop-blur-md ${className}`}
      >
        未评分
      </span>
    );
  }

  const scoreText = Number(rating).toFixed(1);

  if (size === "lg") {
    return (
      <div
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 backdrop-blur-2xl transition-all duration-300 ${tier.badgeClass} ${className}`}
      >
        <div className="flex items-center gap-1">
          <span className={`${tier.icon} size-4 inline-block ${tier.glowClass}`} aria-hidden="true" />
          <span className="font-mono text-base font-bold leading-none tracking-tight">{scoreText}</span>
        </div>
        {showTier && (
          <>
            <span className="h-3 w-px bg-current/25" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-tight uppercase leading-none">
              {tier.label}
            </span>
          </>
        )}
      </div>
    );
  }

  if (size === "md") {
    return (
      <div
        className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs backdrop-blur-xl transition-all duration-300 ${tier.badgeClass} ${className}`}
      >
        <span className={`${tier.icon} size-3 inline-block ${tier.glowClass}`} aria-hidden="true" />
        <span className="font-mono font-bold leading-none tracking-tight">{scoreText}</span>
        {showTier && (
          <>
            <span className="h-2.5 w-px bg-current/25" aria-hidden="true" />
            <span className="text-[11px] font-medium tracking-tight leading-none">{tier.label}</span>
          </>
        )}
      </div>
    );
  }

  // sm 尺寸（卡片紧凑型，深度收窄阔度）
  return (
    <div
      className={`inline-flex shrink-0 items-center gap-0.5 rounded border px-1 py-0.5 text-xs backdrop-blur-md transition-all duration-300 ${tier.badgeClass} ${className}`}
      title={`${scoreText} 分 · ${tier.label}`}
    >
      <span className={`${tier.icon} size-2.5 inline-block shrink-0 ${tier.glowClass}`} aria-hidden="true" />
      <span className="font-mono text-[11px] font-bold leading-none tracking-tight">{scoreText}</span>
      {showTier && (
        <span className="text-[10px] font-medium opacity-85 border-l border-current/25 pl-0.5 ml-0.5 leading-none tracking-tighter">
          {tier.label}
        </span>
      )}
    </div>
  );
}

