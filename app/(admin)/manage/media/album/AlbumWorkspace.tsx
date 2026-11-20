"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { AlbumStructure } from "@/lib/admin/album-structure";
import AlbumRail from "./AlbumRail";
import AlbumStrip from "./AlbumStrip";
import QuickAddTrackDialog from "./QuickAddTrackDialog";
import type { AlbumCurrentItem } from "./shared";

/** 专辑与曲目共用的编辑工作台：左侧为标题与表单，右侧为曲目结构栏；窄屏时结构栏收成表单上方的横条。 */
export default function AlbumWorkspace({
  structure,
  current,
  header,
  initialAdd,
  children,
}: {
  structure: AlbumStructure;
  current: AlbumCurrentItem;
  header: ReactNode;
  initialAdd?: boolean;
  children: ReactNode;
}) {
  const [adding, setAdding] = useState(Boolean(initialAdd));

  useEffect(() => {
    if (!initialAdd) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("add");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, [initialAdd]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="min-w-0 space-y-6">
        {header}
        <AlbumStrip structure={structure} current={current} onAdd={() => setAdding(true)} />
        {children}
      </div>
      <AlbumRail structure={structure} current={current} onAdd={() => setAdding(true)} />
      {adding && <QuickAddTrackDialog key="add-track" structure={structure} onClose={() => setAdding(false)} />}
    </div>
  );
}
