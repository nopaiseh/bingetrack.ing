"use client";
import Image from "next/image";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { searchChoices } from "./reference-actions";
import type { Choice } from "@/lib/admin/catalog";

/** 下拉挂到 body：嵌套在带 backdrop-filter 的卡片内时，毛玻璃只能模糊卡片自身而显得透明。
 * 外包 admin-shell 以沿用管理区的按钮样式；定位随滚动与缩放同步，与选择器等宽。
 * 固定定位无法随页面滚入视口，下方空间不足时改向上展开，并按可用空间限制高度。 */
function FloatingResults({ root, input, listRef, children }: {
  root: RefObject<HTMLDivElement | null>;
  input: RefObject<HTMLInputElement | null>;
  listRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);
  useLayoutEffect(() => {
    /** 以选择器定宽、搜索框上下沿定位，选择空间较大的一侧展开。 */
    function update() {
      const box = root.current?.getBoundingClientRect();
      const anchor = input.current?.getBoundingClientRect() ?? box;
      if (!box || !anchor) return;
      const gap = 8;
      const margin = 16;
      const below = window.innerHeight - anchor.bottom - gap - margin;
      const above = anchor.top - gap - margin;
      const upward = below < 256 && above > below;
      setPosition({
        ...(upward ? { bottom: window.innerHeight - anchor.top + gap } : { top: anchor.bottom + gap }),
        left: box.left,
        width: box.width,
        maxHeight: Math.max(120, Math.min(256, upward ? above : below)),
      });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [root, input]);
  if (!position) return null;
  return createPortal(
    <div className="admin-shell">
      <div
        ref={listRef}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        style={position}
        className="surface-overlay custom-scrollbar fixed z-50 overflow-y-auto rounded-xl p-2"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** 搜索已有资料并显式选择；名称标签可新增，父条目只能选已有内容。 */
export default function ChoicePicker({
  kind,
  name,
  label,
  icon,
  initial = [],
  multiple = true,
  allowCreate = false,
  required = false,
  sortable = name === "actors",
  withCharacter = false,
  onSelect,
}: {
  kind: string;
  name: string;
  label: string;
  icon?: string;
  initial?: Choice[];
  multiple?: boolean;
  allowCreate?: boolean;
  required?: boolean;
  sortable?: boolean;
  /** 在每个已选标签内提供角色名输入，隐藏字段按「姓名<Tab>角色」逐行提交。 */
  withCharacter?: boolean;
  onSelect?: (value: Choice[]) => void;
}) {
  const [selected, setSelected] = useState(initial);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  // 人物允许同名，以 ID 区分并以别名提示；其余资料名称唯一，按名称判重。
  const byId = kind === "people";
  const same = (a: Choice, b: Choice) => (byId ? a.id === b.id : a.name === b.name);
  // 新建人物只会匹配无别名的同名者，已有这样的人物时不再提供新增。
  const exists = (item: Choice) => item.name === term.trim() && (!byId || !item.detail);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchChoices(kind, term);
        if (active) {
          setChoices(result.choices);
          setError(result.error ?? "");
        }
      } catch {
        if (active) setError("搜索失败，请重新输入后重试。");
      } finally {
        // 被新搜索取代的旧请求不能结束加载状态，否则新请求进行中会闪回“无结果”。
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [kind, term, open]);

  /** 通过隐藏字段复用现有服务端验证，显式通知外层表单存在修改。 */
  function change(next: Choice[]) {
    setSelected(next);
    onSelect?.(next);
    root.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /** 关联资料去重，单选父级保存真实 ID。选择后清理检索词并关闭下拉。 */
  function choose(choice: Choice) {
    change(multiple ? [...selected.filter((item) => !same(item, choice)), choice] : [choice]);
    setOpen(false);
    setTerm("");
    setActiveIndex(-1);
  }

  const newName = term.trim();
  // 可定位的候选项：搜索结果在前，允许新增时末尾附新增项。
  const options: { choice: Choice; create?: boolean }[] = [
    ...(loading || error ? [] : choices.filter((item) => !selected.some((value) => same(value, item))).map((choice) => ({ choice }))),
    ...(allowCreate && newName && !selected.some(exists) && !choices.some(exists)
      ? [{ choice: { id: `new:${newName}`, name: newName }, create: true }]
      : []),
  ];
  const active = Math.min(activeIndex, options.length - 1);
  const resultsId = `${listId}-results`;
  const optionId = (index: number) => `${listId}-option-${index}`;

  // 键盘定位到列表可视区外的候选项时，把它滚入视野。
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-option-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, listId]);

  /** 两种模式共用的搜索框行为：上下键定位候选项，回车确认，Escape 关闭。
   * 搜索进行中回车不做选择，避免结果返回前误选新增项。 */
  const comboboxProps = {
    ref: input,
    id: listId,
    value: term,
    autoComplete: "off",
    role: "combobox",
    "aria-autocomplete": "list",
    "aria-haspopup": "listbox",
    "aria-expanded": open,
    "aria-controls": resultsId,
    "aria-activedescendant": open && active >= 0 ? optionId(active) : undefined,
    onFocus: () => setOpen(true),
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      setTerm(event.target.value);
      setOpen(true);
      // 防抖等待期间即视为搜索中，旧结果不可再被回车选中。
      setLoading(true);
      setActiveIndex(event.target.value.trim() ? 0 : -1);
    },
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setOpen(true);
        const next = event.key === "ArrowDown" ? Math.min(active + 1, options.length - 1) : Math.max(active - 1, 0);
        setActiveIndex(next);
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (open && !loading && options[active]) choose(options[active].choice);
        else setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    },
  } as const;

  const results = (
    <>
      {loading && <p role="status" className="p-2 text-sm text-neutral-400">正在搜索…</p>}
      {error && <p role="alert" className="p-2 text-sm text-red-300">{error}</p>}
      {!loading && !error && choices.length === 0 && <p className="p-2 text-sm text-neutral-400">没有匹配资料</p>}
      {options.length > 0 && (
        <div id={resultsId} role="listbox" aria-label={`${label}搜索结果`}>
          {options.map(({ choice, create }, index) => (
            <button
              key={choice.id}
              id={optionId(index)}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={index === active}
              data-active={index === active}
              className="dropdown-option"
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(choice)}
            >
              {create ? (
                <>
                  <span className="i-material-symbols-add-rounded size-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                  <span className="min-w-0 break-words">新增并关联「{newName}」</span>
                </>
              ) : (
                <>
                  {choice.cover_url && (
                    <Image src={choice.cover_url} width={28} height={42} alt="" className="h-10 w-7 shrink-0 rounded object-cover shadow-sm" />
                  )}
                  <span className="min-w-0 break-words font-medium">
                    {choice.name}
                    {choice.detail && <span className="block text-xs font-normal text-neutral-400">{choice.detail}</span>}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      )}
      <p className="p-2 text-[11px] text-neutral-400 border-t border-white/5 mt-1">
        {allowCreate ? "新名称将在保存资料时创建。" : "最多显示 20 项，可输入完整标题缩小范围。"}
      </p>
    </>
  );

  if (!multiple) {
    return (
      <div
        ref={root}
        className="relative min-w-0"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget) && !list.current?.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <input type="hidden" name={name} value={selected[0]?.id ?? ""} />
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor={selected.length > 0 ? undefined : listId}>{label}</label>
          {required && <span className="text-[11px] font-normal text-rose-400/80">必填</span>}
        </div>
        {selected.length > 0 ? (
          <div className="flex h-[42px] items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="i-material-symbols-folder-rounded size-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
              <span className="truncate font-medium text-white">{selected[0].name}</span>
              {selected[0].detail && <span className="truncate text-xs text-neutral-400">({selected[0].detail})</span>}
            </div>
            <button
              type="button"
              aria-label={`更换${label}：当前为${selected[0].name}`}
              className="!min-h-0 !border-0 !bg-transparent !p-1 text-xs text-neutral-400 transition-colors hover:text-white shrink-0"
              onClick={() => {
                change([]);
                setTerm("");
                setOpen(true);
                setTimeout(() => input.current?.focus(), 50);
              }}
            >
              更换
            </button>
          </div>
        ) : (
          <input
            {...comboboxProps}
            placeholder={`搜索${label}`}
          />
        )}
        {open && (
          <FloatingResults root={root} input={input} listRef={list}>
            {results}
          </FloatingResults>
        )}
      </div>
    );
  }

  return (
    <div
      ref={root}
      className="choice-picker-card relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && !list.current?.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <input
        type="hidden"
        name={name}
        value={selected
          .map((item) => {
            // 人物逐行提交「ID<Tab>姓名<Tab>角色」，新建人物的 ID 留空。
            const line = byId ? `${item.id.startsWith("new:") ? "" : item.id}\t${item.name}` : item.name;
            return withCharacter && item.character ? `${line}\t${item.character}` : line;
          })
          .join("\n")}
      />

      {/* 卡片头部：图标 + 标题 + 数量徽章 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className={`${icon} size-4 text-[var(--accent)] shrink-0`} aria-hidden="true" />}
          <label htmlFor={listId} className="cursor-pointer font-medium text-sm text-white/90">
            {label}
          </label>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold transition-all ${
              selected.length > 0
                ? "border border-rose-500/30 bg-rose-500/15 text-rose-300"
                : "border border-white/10 bg-white/5 text-neutral-400"
            }`}
          >
            {selected.length}
          </span>
        </div>
        {required && <span className="text-[11px] font-normal text-rose-400/80">必填</span>}
      </div>

      {/* 已选标签列表 */}
      {selected.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {selected.map((item, index) => (
            <li key={item.id} className="admin-tag-chip group/chip max-w-full">
              {sortable && (
                <span className="rounded bg-white/10 px-1 py-0.5 font-mono text-[10px] font-medium leading-none text-neutral-300">
                  #{index + 1}
                </span>
              )}
              <span className="break-words font-medium">{item.name}</span>
              {byId && item.detail && <span className="break-words text-xs text-neutral-400">({item.detail})</span>}
              {withCharacter && (
                <input
                  className="admin-chip-character"
                  value={item.character ?? ""}
                  maxLength={200}
                  autoComplete="off"
                  placeholder="饰演角色"
                  aria-label={`${item.name}饰演的角色`}
                  onChange={(event) => {
                    // 制表符和换行是隐藏字段的分隔符，不能出现在角色名里。
                    const character = event.target.value.replace(/[\t\r\n]+/g, " ");
                    change(selected.map((value) => (value.id === item.id ? { ...value, character } : value)));
                  }}
                />
              )}
                {sortable ? (
                  <div className="ml-1 flex items-center gap-0.5 border-l border-white/15 pl-1">
                    {index > 0 && (
                      <button
                        type="button"
                        title={`前移${item.name}`}
                        aria-label={`上移${item.name}`}
                        className="inline-flex size-4.5 items-center justify-center rounded text-neutral-400 hover:bg-white/15 hover:text-white transition-colors"
                        onClick={() => {
                          const next = [...selected];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          change(next);
                        }}
                      >
                        <span className="i-material-symbols-chevron-left-rounded size-3.5" aria-hidden="true" />
                      </button>
                    )}
                    {index < selected.length - 1 && (
                      <button
                        type="button"
                        title={`后移${item.name}`}
                        aria-label={`下移${item.name}`}
                        className="inline-flex size-4.5 items-center justify-center rounded text-neutral-400 hover:bg-white/15 hover:text-white transition-colors"
                        onClick={() => {
                          const next = [...selected];
                          [next[index + 1], next[index]] = [next[index], next[index + 1]];
                          change(next);
                        }}
                      >
                        <span className="i-material-symbols-chevron-right-rounded size-3.5" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      title={`移除关联：${item.name}`}
                      aria-label={`移除关联：${item.name}`}
                      className="inline-flex size-4.5 items-center justify-center rounded text-neutral-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
                      onClick={() => change(selected.filter((value) => value.id !== item.id))}
                    >
                      <span className="i-material-symbols-close-rounded size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    title={`移除关联：${item.name}`}
                    aria-label={`移除关联：${item.name}`}
                    className="inline-flex size-4 items-center justify-center rounded-full text-neutral-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors ml-0.5"
                    onClick={() => change(selected.filter((value) => value.id !== item.id))}
                  >
                    <span className="i-material-symbols-close-rounded size-3" aria-hidden="true" />
                  </button>
                )}
              </li>
          ))}
        </ul>
      )}

      {/* 嵌入式搜索框 */}
      <div className="relative flex items-center">
        <span className="i-material-symbols-search-rounded pointer-events-none absolute left-3 z-10 size-4 text-white/40" aria-hidden="true" />
        <input
          {...comboboxProps}
          placeholder={`搜索${label}…`}
          className="!pl-9 !py-2 !text-xs !bg-black/30 hover:!bg-black/40 focus:!bg-black/60 !rounded-xl"
        />
      </div>

      {/* 下拉结果浮层 */}
      {open && (
        <FloatingResults root={root} input={input} listRef={list}>
          {results}
        </FloatingResults>
      )}
    </div>
  );
}
