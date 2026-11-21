"use client";

import Link from "next/link";
import type { ReactNode } from "react";

const SCHEMES = [
  { id: "a", label: "方案 A · 四格并列" },
  { id: "b", label: "方案 B · 主次两层" },
  { id: "c", label: "方案 C · 密度行" },
] as const;

/** 设计原型页共用外壳：方案切换与说明，不改主页。 */
export default function PrototypeChrome({
  scheme,
  title,
  blurb,
  children,
}: {
  scheme: "a" | "b" | "c";
  title: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <div className="container mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-8 pt-20 sm:gap-5 sm:px-6 sm:pt-22 md:pb-12 lg:px-8 lg:pt-24">
      <div className="rounded-2xl border border-dashed border-white/20 bg-black/30 px-4 py-3 text-sm text-fg-secondary">
        <p className="font-medium text-white">媒体全景设计原型 · {title}</p>
        <p className="mt-1 text-xs leading-5 sm:text-sm sm:leading-6">{blurb}</p>
        <p className="mt-1 text-xs text-fg-muted">Mock 数据 · 图书为 0 用于验收空态 · 不连生产库</p>
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="方案切换">
          {SCHEMES.map((item) => (
            <Link
              key={item.id}
              href={`/design/media-panorama/${item.id}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                scheme === item.id
                  ? "bg-white/15 text-white"
                  : "bg-black/25 text-fg-secondary hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
