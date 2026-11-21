"use client";
import { useState, type ReactNode } from "react";
import type { AlbumStructure } from "@/lib/admin/album-structure";
import { StructureWorkspaceShell } from "../structure-shared";
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

  return (
    <StructureWorkspaceShell
      header={header}
      clearAddParam={Boolean(initialAdd)}
      strip={<AlbumStrip structure={structure} current={current} onAdd={() => setAdding(true)} />}
      rail={<AlbumRail structure={structure} current={current} onAdd={() => setAdding(true)} />}
      dialog={
        adding ? (
          <QuickAddTrackDialog key="add-track" structure={structure} onClose={() => setAdding(false)} />
        ) : null
      }
    >
      {children}
    </StructureWorkspaceShell>
  );
}
