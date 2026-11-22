"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

/**
 * 解析截断行数：仅接受有限正整数（截断小数）；非法值回落到默认。
 * 默认：persistClamp 为 4，否则为 3。
 */
export function resolveClampLines(lines: number | undefined, persistClamp: boolean): number {
  const fallback = persistClamp ? 4 : 3;
  if (lines == null || !Number.isFinite(lines)) return fallback;
  const normalized = Math.trunc(lines);
  return normalized >= 1 ? normalized : fallback;
}

/**
 * 长简介默认按行截断，超出时用粉色展开／收起按钮（aria-expanded，命中区 ≥44px）。
 * persistClamp：各断点都保持截断；否则 ≥1024px 取消截断。
 * fullWidth：不限制 70ch，占满容器宽度（季详情用）。
 *
 * 行数 3／4 继续用 Uno 静态类（`line-clamp-3`／`line-clamp-4`），保证现有页面像素一致；
 * 其他正整数用 `--clamp-lines` + `.clamped-copy-n`，避开工具类静态提取限制。
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
  /** 截断行数（正整数）；默认 persistClamp 为 4，否则为 3。非法值回落默认。 */
  lines?: number;
  expandLabel?: string;
  collapseLabel?: string;
  fullWidth?: boolean;
}) {
  const clampLines = resolveClampLines(lines, persistClamp);
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

  const useStaticClamp = clampLines === 3 || clampLines === 4;
  const clampClass = expanded
    ? ""
    : useStaticClamp
      ? clampLines === 4
        ? persistClamp
          ? "line-clamp-4"
          : "line-clamp-4 lg:line-clamp-none"
        : persistClamp
          ? "line-clamp-3"
          : "line-clamp-3 lg:line-clamp-none"
      : persistClamp
        ? "clamped-copy-n"
        : "clamped-copy-n clamped-copy-n--lg-free";

  const clampStyle: CSSProperties | undefined =
    expanded || useStaticClamp ? undefined : ({ ["--clamp-lines" as string]: String(clampLines) } as CSSProperties);

  const body = `${fullWidth ? "min-w-0" : "max-w-[70ch]"} whitespace-pre-line text-left text-sm leading-7 tracking-wide text-fg-secondary wrap-break-word md:text-base ${clampClass} ${className}`;

  return (
    <div className="min-w-0">
      <p ref={textRef} className={body} style={clampStyle}>
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
