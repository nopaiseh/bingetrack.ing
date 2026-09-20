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
      badgeClass: "border-amber-400/35 bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/20 shadow-[0_1px_0_0_rgba(251,191,36,0.15)_inset]",
      glowClass: "text-amber-300",
      textClass: "text-amber-300 font-bold",
      icon: "i-material-symbols-stars-rounded",
      isMasterpiece: true,
    };
  }
  if (num >= 8.0) {
    return {
      label: "佳作",
      badgeClass: "border-amber-300/25 bg-amber-300/5 text-amber-200/90 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]",
      glowClass: "text-amber-200/90",
      textClass: "text-amber-200/90 font-medium",
      icon: "i-material-symbols-star-rounded",
    };
  }
  if (num >= 7.0) {
    return {
      label: "良作",
      badgeClass: "border-emerald-400/20 bg-emerald-400/5 text-emerald-300/85 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]",
      glowClass: "text-emerald-300/85",
      textClass: "text-emerald-300/85 font-medium",
      icon: "i-material-symbols-star-rounded",
    };
  }
  if (num >= 6.0) {
    return {
      label: "尚可",
      badgeClass: "border-sky-400/20 bg-sky-400/5 text-sky-300/80 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]",
      glowClass: "text-sky-300/80",
      textClass: "text-sky-300/80 font-medium",
      icon: "i-material-symbols-star-rounded",
    };
  }
  if (num >= 5.0) {
    return {
      label: "及格",
      badgeClass: "border-white/10 bg-white/5 text-zinc-300 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]",
      glowClass: "text-zinc-300",
      textClass: "text-zinc-300 font-medium",
      icon: "i-material-symbols-star-half-rounded",
    };
  }
  if (num >= 4.0) {
    return {
      label: "平庸",
      badgeClass: "border-white/8 bg-white/[0.03] text-zinc-400 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]",
      glowClass: "text-zinc-400",
      textClass: "text-zinc-400",
      icon: "i-material-symbols-star-outline-rounded",
    };
  }
  if (num >= 3.0) {
    return {
      label: "较差",
      badgeClass: "border-purple-400/15 bg-purple-400/5 text-purple-300/70 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]",
      glowClass: "text-purple-300/70",
      textClass: "text-purple-300/70",
      icon: "i-material-symbols-star-outline-rounded",
    };
  }
  if (num >= 2.0) {
    return {
      label: "烂片",
      badgeClass: "border-rose-400/15 bg-rose-400/5 text-rose-300/70 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]",
      glowClass: "text-rose-300/70",
      textClass: "text-rose-300/70",
      icon: "i-material-symbols-thumb-down-rounded",
    };
  }
  if (num >= 1.0) {
    return {
      label: "灾难",
      badgeClass: "border-red-500/20 bg-red-950/20 text-red-300/75 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]",
      glowClass: "text-red-300/75",
      textClass: "text-red-300/75 font-semibold",
      icon: "i-material-symbols-warning-rounded",
    };
  }
  // 0.0 ~ 0.9
  return {
    label: "神烂",
    badgeClass: "border-red-700/25 bg-red-950/30 text-red-400/80 ring-1 ring-red-500/15 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]",
    glowClass: "text-red-400/80",
    textClass: "text-red-400/80 font-semibold",
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
        className={`inline-flex shrink-0 items-center rounded border border-white/10 ${unratedPad} font-medium leading-none text-white/70 backdrop-blur-md ${className}`}
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
      className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-xs backdrop-blur-md transition-all duration-300 ${tier.badgeClass} ${className}`}
      title={`${scoreText} 分 · ${tier.label}`}
    >
      <span className={`${tier.icon} size-2.5 inline-block shrink-0 ${tier.glowClass}`} aria-hidden="true" />
      <span className="font-mono text-xs font-bold leading-none tracking-tight">{scoreText}</span>
      {showTier && (
        <span className="text-[10px] font-normal opacity-70 border-l border-current/25 pl-1 ml-0.5 leading-none tracking-tight">
          {tier.label}
        </span>
      )}
    </div>
  );
}

