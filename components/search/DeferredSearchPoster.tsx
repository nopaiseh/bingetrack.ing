"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { SEARCH_POSTER_ROOT_MARGIN } from "@/lib/search-poster-defer";

/**
 * Search poster that optionally waits until near the viewport before setting
 * the image src. Titles stay outside this component so they remain in the DOM
 * and accessibility tree regardless of image load state.
 */
export default function DeferredSearchPoster({
  src,
  defer,
  sizes,
  preload = false,
  eager = false,
}: {
  src: string;
  /** When true, hold off on Image until IntersectionObserver fires. */
  defer: boolean;
  sizes: string;
  /** Above-the-fold LCP candidate: preload + fetchPriority=high (#216). */
  preload?: boolean;
  /** Above-the-fold remainder: eager load. */
  eager?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(!defer);

  useEffect(() => {
    if (!defer || show) return;
    const el = ref.current;
    if (!el) return;

    // Reveal from the observer callback (or a timeout fallback) so we never
    // setState synchronously inside the effect body.
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setShow(true), 0);
      return () => window.clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShow(true);
          observer.disconnect();
        }
      },
      { rootMargin: SEARCH_POSTER_ROOT_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [defer, show]);

  return (
    <div ref={ref} className="absolute inset-0" data-poster-deferred={defer && !show ? "true" : undefined}>
      {show ? (
        <Image
          src={src}
          alt=""
          fill
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          sizes={sizes}
          preload={preload}
          fetchPriority={preload ? "high" : undefined}
          loading={preload ? undefined : eager ? "eager" : "lazy"}
        />
      ) : null}
    </div>
  );
}
