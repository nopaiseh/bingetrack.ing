"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { SeriesStructure } from "@/lib/admin/series-structure";
import QuickAddDialog from "./QuickAddDialog";
import SeriesRail from "./SeriesRail";
import SeriesStrip from "./SeriesStrip";
import type { CurrentItem, QuickAddKind } from "./shared";

/** 电视节目、季、单集共用的编辑工作台：左侧为标题与表单，右侧为剧集结构栏；窄屏时结构栏收成表单上方的卡片。 */
export default function SeriesWorkspace({ structure, current, header, initialAdd, children }: { structure: SeriesStructure; current: CurrentItem; header: ReactNode; initialAdd?: QuickAddKind; children: ReactNode }) {
  const canAdd = (kind: QuickAddKind | undefined) => kind === "season" || (kind === "episode" && Boolean(structure.expandedSeasonId));
  const [adding, setAdding] = useState<QuickAddKind | null>(canAdd(initialAdd) ? initialAdd! : null);

  // 列表页的「新增季」经 ?add= 打开弹窗；打开后去掉参数，刷新页面不会再次弹出。
  useEffect(() => {
    if (!initialAdd) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("add");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, [initialAdd]);

  return <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
    <div className="min-w-0 space-y-6">
      {header}
      <SeriesStrip structure={structure} current={current} onAdd={setAdding} />
      {children}
    </div>
    <SeriesRail structure={structure} current={current} onAdd={setAdding} />
    {adding && <QuickAddDialog key={adding} kind={adding} structure={structure} onClose={() => setAdding(null)} />}
  </div>;
}
