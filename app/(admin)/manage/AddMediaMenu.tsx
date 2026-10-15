"use client";
import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mediaTypes } from "@/lib/admin/media-form";

/** 可直接新增的顶层类型；季与单集需从所属节目进入。以后加入书本、音乐等类型时在此追加一项。 */
const options = [
  { type: "movie", icon: "i-material-symbols-movie-rounded" },
  { type: "tv_show", icon: "i-material-symbols-tv-rounded" },
] as const;

/** 管理首页的「新增」按钮：展开菜单后选择要新增的媒体类型，类型再多也只占一个按钮。 */
export default function AddMediaMenu() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  /** 收起菜单；键盘操作关闭时把焦点还给按钮。 */
  function close(refocus = false) {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }

  // 点击菜单和按钮以外的地方时收起。
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // 菜单挂到 body，按按钮位置右对齐固定定位，并随滚动与缩放同步。
  useLayoutEffect(() => {
    if (!open) return;
    function updatePosition() {
      const rect = trigger.current?.getBoundingClientRect();
      if (rect) setPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  // 展开后把焦点移到当前定位项，方向键可直接切换。
  useEffect(() => {
    if (open && position) menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]")[active]?.focus();
  }, [open, position, active]);

  return <>
    <button ref={trigger} type="button" className="admin-primary" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      onClick={() => { setActive(0); setOpen(value => !value); }}
      onKeyDown={event => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        setActive(event.key === "ArrowDown" ? 0 : options.length - 1);
        setOpen(true);
      }}>
      <span className="i-material-symbols-add-rounded size-4.5" aria-hidden="true" />新增
      <span className={`i-material-symbols-expand-more-rounded size-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
    {/* 挂到 body：嵌套在带 backdrop-filter 的面板内时，毛玻璃只能模糊面板自身。 */}
    {open && position && createPortal(
      <div ref={menu} id={menuId} role="menu" aria-label="新增类型" className="surface-overlay fixed z-50 w-44 rounded-2xl p-1" style={{ top: position.top, right: position.right }}
        onKeyDown={event => {
          if (event.key === "Escape" || event.key === "Tab") { if (event.key === "Escape") event.preventDefault(); close(event.key === "Escape"); return; }
          const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
          if (!step) return;
          event.preventDefault();
          setActive(index => (index + step + options.length) % options.length);
        }}>
        {options.map(({ type, icon }, index) =>
          <Link key={type} href={`/manage/media/new?type=${type}`} role="menuitem" tabIndex={-1} data-active={active === index} className="dropdown-option outline-none"
            onMouseEnter={() => setActive(index)} onClick={() => close()}>
            <span className={`${icon} size-4.5 shrink-0 text-[var(--accent-light)]`} aria-hidden="true" />{mediaTypes[type]}
          </Link>)}
      </div>,
      document.body,
    )}
  </>;
}
