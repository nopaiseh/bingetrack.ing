"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * 本季简介：默认四行截断，超出时用粉色展开／收起按钮（aria-expanded，命中区 ≥44px）。
 */
export default function SeasonOverview({ text }: { text: string }) {
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
  }, [text, expanded]);

  return (
    <div className="mt-2 min-w-0">
      <p
        ref={textRef}
        className={`max-w-[70ch] whitespace-pre-line text-left text-sm leading-7 tracking-wide text-fg-secondary wrap-break-word md:text-base ${
          expanded ? "" : "line-clamp-4"
        }`}
      >
        {text}
      </p>
      {needsClamp ? (
        <button
          type="button"
          aria-expanded={expanded}
          className="mt-1 inline-flex min-h-11 items-center text-sm text-[var(--accent-hover)]"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "收起" : "展开"}
        </button>
      ) : null}
    </div>
  );
}
