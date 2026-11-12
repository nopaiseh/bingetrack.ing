interface RatingTierInfo {
  label: string;
  badgeClass: string;
  glowClass: string;
  textClass: string;
  icon: string;
  isMasterpiece?: boolean;
}

/** 按 10 级梯度推导评分的视觉体系、标签与光影配置。 */
function getRatingTier(rating: number | null | undefined): RatingTierInfo {
  if (rating == null) {
    return {
      label: "未评分",
      badgeClass: "border-[var(--border)] bg-[var(--surface-2)] text-fg-muted",
      glowClass: "",
      textClass: "text-fg-muted",
      icon: "i-material-symbols-star-outline-rounded",
    };
  }

  const num = Number(rating);
  if (num >= 9.0) {
    return {
      label: "神作",
      badgeClass: "border-[color-mix(in_srgb,var(--warn)_45%,var(--border))] bg-[var(--warn-soft)] text-[var(--warn)]",
      glowClass: "text-[var(--warn)]",
      textClass: "text-[var(--warn)] font-bold",
      icon: "i-material-symbols-stars-rounded",
      isMasterpiece: true,
    };
  }
  if (num >= 8.0) {
    return {
      label: "佳作",
      badgeClass: "border-[color-mix(in_srgb,var(--warn)_45%,var(--border))] bg-[var(--warn-soft)] text-[var(--warn)]",
      glowClass: "text-[var(--warn)]",
      textClass: "text-[var(--warn)] font-medium",
      icon: "i-material-symbols-star-rounded",
    };
  }
  if (num >= 7.0) {
    return {
      label: "良作",
      badgeClass: "border-[color-mix(in_srgb,var(--ok)_45%,var(--border))] bg-[var(--ok-soft)] text-[var(--ok)]",
      glowClass: "text-[var(--ok)]",
      textClass: "text-[var(--ok)] font-medium",
      icon: "i-material-symbols-star-rounded",
    };
  }
  if (num >= 6.0) {
    return {
      label: "尚可",
      badgeClass: "border-[color-mix(in_srgb,#7dd3fc_45%,var(--border))] bg-[color-mix(in_srgb,#7dd3fc_12%,transparent)] text-[#7dd3fc]",
      glowClass: "text-[#7dd3fc]",
      textClass: "text-[#7dd3fc] font-medium",
      icon: "i-material-symbols-star-rounded",
    };
  }
  if (num >= 5.0) {
    return {
      label: "及格",
      badgeClass: "border-[var(--border)] bg-[var(--surface-2)] text-fg-secondary",
      glowClass: "text-fg-secondary",
      textClass: "text-fg-secondary font-medium",
      icon: "i-material-symbols-star-half-rounded",
    };
  }
  if (num >= 4.0) {
    return {
      label: "平庸",
      badgeClass: "border-[var(--border)] bg-[var(--surface-2)] text-fg-muted",
      glowClass: "text-fg-muted",
      textClass: "text-fg-muted",
      icon: "i-material-symbols-star-outline-rounded",
    };
  }
  if (num >= 3.0) {
    return {
      label: "较差",
      badgeClass: "border-[color-mix(in_srgb,var(--violet)_45%,var(--border))] bg-[color-mix(in_srgb,var(--violet)_12%,transparent)] text-[var(--violet)]",
      glowClass: "text-[var(--violet)]",
      textClass: "text-[var(--violet)]",
      icon: "i-material-symbols-star-outline-rounded",
    };
  }
  if (num >= 2.0) {
    return {
      label: "烂片",
      badgeClass: "border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]",
      glowClass: "text-[var(--danger)]",
      textClass: "text-[var(--danger)]",
      icon: "i-material-symbols-thumb-down-rounded",
    };
  }
  if (num >= 1.0) {
    return {
      label: "灾难",
      badgeClass: "border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]",
      glowClass: "text-[var(--danger)]",
      textClass: "text-[var(--danger)] font-semibold",
      icon: "i-material-symbols-warning-rounded",
    };
  }
  // 0.0 ~ 0.9
  return {
    label: "神烂",
    badgeClass: "border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]",
    glowClass: "text-[var(--danger)]",
    textClass: "text-[var(--danger)] font-semibold",
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
    const unratedPad = size === "lg" ? "px-2 py-0.5 text-xs" : "px-1.5 py-0.5 text-xs";
    return (
      <span
        className={`inline-flex shrink-0 items-center rounded border border-[var(--border)] bg-[var(--surface-2)] ${unratedPad} font-medium leading-none text-fg-secondary ${className}`}
      >
        未评分
      </span>
    );
  }

  const scoreText = Number(rating).toFixed(1);

  if (size === "lg") {
    return (
      <div
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 transition-all duration-300 ${tier.badgeClass} ${className}`}
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
        className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs transition-all duration-300 ${tier.badgeClass} ${className}`}
      >
        <span className={`${tier.icon} size-3 inline-block ${tier.glowClass}`} aria-hidden="true" />
        <span className="font-mono font-bold leading-none tracking-tight">{scoreText}</span>
        {showTier && (
          <>
            <span className="h-2.5 w-px bg-current/25" aria-hidden="true" />
            <span className="text-xs font-medium tracking-tight leading-none">{tier.label}</span>
          </>
        )}
      </div>
    );
  }

  // sm 尺寸（卡片紧凑型，深度收窄阔度）
  return (
    <div
      className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-xs transition-all duration-300 ${tier.badgeClass} ${className}`}
      title={`${scoreText} 分 · ${tier.label}`}
    >
      <span className={`${tier.icon} size-2.5 inline-block shrink-0 ${tier.glowClass}`} aria-hidden="true" />
      <span className="font-mono text-xs font-bold leading-none tracking-tight">{scoreText}</span>
      {showTier && (
        <span className="ml-0.5 border-l border-current/25 pl-1 text-xs font-normal leading-none tracking-tight">
          {tier.label}
        </span>
      )}
    </div>
  );
}

