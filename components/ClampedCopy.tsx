"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * 长简介默认按行截断，超出时用粉色展开／收起按钮（aria-expanded，命中区 ≥44px）。
 * persistClamp：各断点都保持截断；否则 ≥1024px 取消截断。
 * fullWidth：不限制 70ch，占满容器宽度（季详情用）。
 */
export default function ClampedCopy({
  text,
  className = "",
  persistClamp = false,
  lines,
  expandLabel = "展开简介 ▾",
  collapseLabel = "收起简介 ▴",
  fullWidth = false,
}: {
  text: string;
  className?: string;
  persistClamp?: boolean;
  /** 截断行数；默认 persistClamp 为 4，否则为 3。 */
  lines?: number;
  expandLabel?: string;
  collapseLabel?: string;
  fullWidth?: boolean;
}) {
  const clampLines = lines ?? (persistClamp ? 4 : 3);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [needsClamp, setNeedsClamp] = useState(false);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const measure = () => {
      if (expanded) return;
      setNeedsClamp(el.scrollHeight > el.clientHeight + 1);
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded, clampLines, persistClamp]);

  const clampClass = expanded
    ? ""
    : clampLines === 4
      ? persistClamp
        ? "line-clamp-4"
        : "line-clamp-4 lg:line-clamp-none"
      : persistClamp
        ? "line-clamp-3"
        : "line-clamp-3 lg:line-clamp-none";

  const body = `${fullWidth ? "min-w-0" : "max-w-[70ch]"} whitespace-pre-line text-left text-sm leading-7 tracking-wide text-fg-secondary wrap-break-word md:text-base ${clampClass} ${className}`;

  return (
    <div className="min-w-0">
      <p ref={textRef} className={body}>
        {text}
      </p>
      {needsClamp ? (
        <button
          type="button"
          aria-expanded={expanded}
          className="mt-1 inline-flex min-h-11 items-center text-sm text-[var(--accent-hover)]"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? collapseLabel : expandLabel}
        </button>
      ) : null}
    </div>
  );
}
