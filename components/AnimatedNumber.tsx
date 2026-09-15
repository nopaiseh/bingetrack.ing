"use client";

import { useState, useEffect, useRef } from "react";

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
}

/** 平滑数字缓动步进组件，首屏挂载即刻呈现静态数值，仅在数值发生实质变更时执行平滑过渡。 */
export default function AnimatedNumber({ value, decimals = 0 }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // 首屏初次挂载时避免占用主线程运行动画
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevValueRef.current = value;
      return;
    }

    const start = prevValueRef.current;
    const end = value;
    if (start === end) return;

    const isReducedMotion = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrameId: number;

    if (isReducedMotion) {
      prevValueRef.current = end;
      animationFrameId = requestAnimationFrame(() => setDisplayValue(end));
      return () => cancelAnimationFrame(animationFrameId);
    }

    const duration = 500;
    const startTime = performance.now();

    const updateNumber = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = start + (end - start) * ease;
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateNumber);
      } else {
        prevValueRef.current = end;
      }
    };

    animationFrameId = requestAnimationFrame(updateNumber);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value]);

  return <>{decimals > 0 ? displayValue.toFixed(decimals) : Math.round(displayValue)}</>;
}
