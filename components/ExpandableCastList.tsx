"use client";

import { useState } from "react";
import SearchTag from "./SearchTag";

interface ExpandableCastListProps {
  casts?: string[];
  initialLimit?: number;
}

/** 呈现支持折叠的主演名单，超出初始上限时提供展开全部与收起切换。 */
export default function ExpandableCastList({
  casts = [],
  initialLimit = 12,
}: ExpandableCastListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!casts || casts.length === 0) {
    return <span className="text-sm text-white/30">-</span>;
  }

  const hasOverflow = casts.length > initialLimit;
  const displayedCasts = hasOverflow && !isExpanded ? casts.slice(0, initialLimit) : casts;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2.5">
        {displayedCasts.map((castMember) => (
          <SearchTag key={castMember} label={castMember} category="cast" />
        ))}
      </div>

      {hasOverflow && (
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            className="surface-subtle inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 transition-all duration-200 hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-white"
          >
            <span
              className={`inline-block size-3.5 transition-transform duration-200 ${
                isExpanded ? "i-material-symbols-keyboard-arrow-up-rounded" : "i-material-symbols-keyboard-arrow-down-rounded"
              }`}
              aria-hidden="true"
            />
            <span>
              {isExpanded
                ? "收起部分演员"
                : `展开剩余 ${casts.length - initialLimit} 位演员`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

