"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { mayLeaveEditor } from "@/lib/admin/navigation";
import type { WatchStatus } from "@/lib/admin/series-structure";
import { statusLabels } from "./series/shared";

/** 列表项较多时提供跳到编号输入框（剧集／曲目共用阈值）。 */
export const JUMP_THRESHOLD = 20;

/** 观看／收听状态圆点：看过实心、在看半满、没看过空心，形状不同，不只靠颜色区分。 */
export function StatusDot({ status, label = statusLabels[status] }: { status: WatchStatus; label?: string }) {
  return <span className={`status-dot status-dot-${status}`} role="img" aria-label={label} />;
}

/** 把列表内的元素滚到容器中部，不牵动整页滚动。 */
export function centerInside(container: HTMLElement | null, element: HTMLElement | null, axis: "x" | "y") {
  if (!container || !element) return;
  if (axis === "y") container.scrollTop = element.offsetTop - container.clientHeight / 2 + element.offsetHeight / 2;
  else container.scrollLeft = element.offsetLeft - container.clientWidth / 2 + element.offsetWidth / 2;
}

/** 离开前复用未保存检查的站内跳转。 */
export function useSafeNavigate() {
  const router = useRouter();
  return (href: string) => {
    if (mayLeaveEditor()) router.push(href);
  };
}

/** 当前项变化时，把 `[aria-current=page]` 滚到容器中部。 */
export function useCenterCurrent(axis: "x" | "y", currentId: string) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = scroller.current;
    centerInside(box, box?.querySelector<HTMLElement>('[aria-current="page"]') ?? null, axis);
  }, [axis, currentId]);
  return scroller;
}

/** 跳到编号：输入时滚动，回车打开；窄屏条可只在回车时跳转。 */
export function JumpNumberField({
  label,
  placeholder,
  onJump,
  scrollOnChange = false,
  className = "font-mono !text-[13px]",
  withSearchIcon = false,
}: {
  label: string;
  placeholder: string;
  onJump: (value: string, open: boolean) => void;
  scrollOnChange?: boolean;
  className?: string;
  withSearchIcon?: boolean;
}) {
  const input = (
    <input
      type="number"
      inputMode="numeric"
      min="0"
      placeholder={placeholder}
      enterKeyHint="go"
      onChange={scrollOnChange ? (event) => onJump(event.target.value, false) : undefined}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onJump(event.currentTarget.value, true);
        }
      }}
      className={withSearchIcon ? `!min-h-10 !py-2 !pl-9 ${className}` : className}
    />
  );
  if (!withSearchIcon) {
    return (
      <label>
        <span className="sr-only">{label}</span>
        {input}
      </label>
    );
  }
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <span
        className="i-material-symbols-search-rounded pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
        aria-hidden="true"
      />
      {input}
    </label>
  );
}

/** 桌面／窄屏共用的工作台壳：左表单＋结构条，右结构栏，可选弹窗；`?add=` 打开后清掉参数。 */
export function StructureWorkspaceShell({
  header,
  strip,
  rail,
  dialog,
  children,
  clearAddParam,
}: {
  header: ReactNode;
  strip: ReactNode;
  rail: ReactNode;
  dialog?: ReactNode;
  children: ReactNode;
  clearAddParam?: boolean;
}) {
  useEffect(() => {
    if (!clearAddParam) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("add");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, [clearAddParam]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="min-w-0 space-y-6">
        {header}
        {strip}
        {children}
      </div>
      {rail}
      {dialog}
    </div>
  );
}
