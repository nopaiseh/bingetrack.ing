"use client";

import { useMemo, useState } from "react";
import CatalogStatGrid from "@/components/CatalogStatGrid";
import MediaRow from "@/components/MediaRow";
import type { MediaCard } from "@/lib/types";

type BookFilter = "all" | "want_to_watch" | "in_progress" | "watched";

const FILTERS: { id: BookFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "want_to_watch", label: "想读" },
  { id: "in_progress", label: "在读" },
  { id: "watched", label: "读过" },
];

export type BookCatalogStats = {
  total: number;
  reading: number;
  read: number;
  want: number;
};

/** 图书目录：统计卡、筛选标签，以及在读／已读／想读分区。 */
export default function BooksCatalog({
  reading,
  read,
  want,
  stats,
}: {
  reading: MediaCard[];
  read: MediaCard[];
  want: MediaCard[];
  stats: BookCatalogStats;
}) {
  const [filter, setFilter] = useState<BookFilter>("all");

  const statItems = [
    { label: "图书总数量", value: stats.total, href: "/search?type=book" },
    { label: "在读", value: stats.reading, href: "/search?type=book&status=in_progress" },
    { label: "读过的书", value: stats.read, href: "/search?type=book&status=watched" },
    { label: "想读", value: stats.want, href: "/search?type=book&status=want_to_watch" },
  ];

  const sections = useMemo(() => {
    const all = [
      {
        key: "reading" as const,
        title: "在读",
        items: reading,
        viewAllLink: "/search?type=book&status=in_progress",
        filterId: "in_progress" as BookFilter,
      },
      {
        key: "read" as const,
        title: "我已读",
        items: read,
        viewAllLink: "/search?type=book&status=watched",
        filterId: "watched" as BookFilter,
      },
      {
        key: "want" as const,
        title: "我想读",
        items: want,
        viewAllLink: "/search?type=book&status=want_to_watch",
        filterId: "want_to_watch" as BookFilter,
      },
    ];
    if (filter === "all") return all;
    return all.filter((section) => section.filterId === filter);
  }, [filter, reading, read, want]);

  let eagerBudget = 2;

  return (
    <div className="relative min-h-[60vh] pt-14 text-fg">
      <div className="container relative z-1 mx-auto w-full max-w-7xl px-4 pb-8 pt-12 sm:px-6 md:pb-12 lg:px-8">
        <h1 className="sr-only">图书</h1>
        <CatalogStatGrid items={statItems} />

        <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label="阅读状态筛选">
          {FILTERS.map((item) => {
            const selected = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(item.id)}
                className={`focus-ring inline-flex min-h-10 items-center rounded-xl border px-3.5 text-sm font-medium transition-colors ${
                  selected
                    ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-hover)]"
                    : "border-[var(--border)] bg-[var(--surface-panel)] text-fg-secondary hover:border-white/25 hover:text-fg"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-12">
          {sections.map((section) => {
            const eagerCount = section.items.length > 0 && eagerBudget > 0 ? Math.min(2, eagerBudget) : 0;
            if (eagerCount > 0) eagerBudget = 0;
            return (
              <MediaRow
                key={section.key}
                title={section.title}
                items={section.items}
                eagerCount={eagerCount}
                viewAllLink={section.viewAllLink}
                type="books"
                hideStatusBadge
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
