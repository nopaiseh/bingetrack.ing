import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import HoverPrefetchLink from "@/components/HoverPrefetchLink";

// next/link 不会把 prefetch 写到 DOM 上，测试替身用 data-prefetch 露出这个属性。
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    prefetch?: boolean | "auto" | null;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      data-prefetch={prefetch === false ? "false" : prefetch === null ? "null" : String(prefetch ?? "")}
      {...props}
    >
      {children}
    </a>
  ),
}));

test("HoverPrefetchLink 初始关闭视口预取，悬停后恢复默认预取", () => {
  render(<HoverPrefetchLink href="/movies/demo">详情</HoverPrefetchLink>);
  const link = screen.getByRole("link", { name: "详情" });
  expect(link).toHaveAttribute("data-prefetch", "false");

  fireEvent.mouseEnter(link);
  expect(link).toHaveAttribute("data-prefetch", "null");
});

test("HoverPrefetchLink 在焦点与触摸时也会开启预取", () => {
  render(<HoverPrefetchLink href="/shows/demo">节目</HoverPrefetchLink>);
  const link = screen.getByRole("link", { name: "节目" });
  expect(link).toHaveAttribute("data-prefetch", "false");

  fireEvent.focus(link);
  expect(link).toHaveAttribute("data-prefetch", "null");
});

test("HoverPrefetchLink 触摸开始会开启预取", () => {
  render(<HoverPrefetchLink href="/books/demo">图书</HoverPrefetchLink>);
  const link = screen.getByRole("link", { name: "图书" });
  expect(link).toHaveAttribute("data-prefetch", "false");

  fireEvent.touchStart(link);
  expect(link).toHaveAttribute("data-prefetch", "null");
});

test("HoverPrefetchLink 显式 prefetch={false} 时始终关闭预取", () => {
  render(
    <HoverPrefetchLink href="/manage" prefetch={false}>
      管理
    </HoverPrefetchLink>,
  );
  const link = screen.getByRole("link", { name: "管理" });
  expect(link).toHaveAttribute("data-prefetch", "false");

  fireEvent.mouseEnter(link);
  fireEvent.focus(link);
  fireEvent.touchStart(link);
  expect(link).toHaveAttribute("data-prefetch", "false");
});

test("HoverPrefetchLink 保留调用方的悬停与焦点回调", () => {
  const onMouseEnter = vi.fn();
  const onFocus = vi.fn();
  const onTouchStart = vi.fn();
  render(
    <HoverPrefetchLink href="/albums/demo" onMouseEnter={onMouseEnter} onFocus={onFocus} onTouchStart={onTouchStart}>
      专辑
    </HoverPrefetchLink>,
  );
  const link = screen.getByRole("link", { name: "专辑" });
  fireEvent.mouseEnter(link);
  fireEvent.focus(link);
  fireEvent.touchStart(link);
  expect(onMouseEnter).toHaveBeenCalledOnce();
  expect(onFocus).toHaveBeenCalledOnce();
  expect(onTouchStart).toHaveBeenCalledOnce();
});
