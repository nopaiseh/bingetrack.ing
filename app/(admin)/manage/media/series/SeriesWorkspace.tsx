"use client";
import { useState, type ReactNode } from "react";
import type { SeriesStructure } from "@/lib/admin/series-structure";
import { StructureWorkspaceShell } from "../structure-shared";
import QuickAddDialog from "./QuickAddDialog";
import SeriesRail from "./SeriesRail";
import SeriesStrip from "./SeriesStrip";
import type { CurrentItem, QuickAddKind } from "./shared";

/** 电视节目、季、单集共用的编辑工作台：左侧为标题与表单，右侧为剧集结构栏；窄屏时结构栏收成表单上方的卡片。 */
export default function SeriesWorkspace({
  structure,
  current,
  header,
  initialAdd,
  children,
}: {
  structure: SeriesStructure;
  current: CurrentItem;
  header: ReactNode;
  initialAdd?: QuickAddKind;
  children: ReactNode;
}) {
  const canAdd = (kind: QuickAddKind | undefined) =>
    kind === "season" || (kind === "episode" && Boolean(structure.expandedSeasonId));
  const [adding, setAdding] = useState<QuickAddKind | null>(canAdd(initialAdd) ? initialAdd! : null);

  return (
    <StructureWorkspaceShell
      header={header}
      clearAddParam={Boolean(initialAdd)}
      strip={<SeriesStrip structure={structure} current={current} onAdd={setAdding} />}
      rail={<SeriesRail structure={structure} current={current} onAdd={setAdding} />}
      dialog={
        adding ? (
          <QuickAddDialog key={adding} kind={adding} structure={structure} onClose={() => setAdding(null)} />
        ) : null
      }
    >
      {children}
    </StructureWorkspaceShell>
  );
}
