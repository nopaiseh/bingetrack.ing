"use client";

import Link from "next/link";
import { useState, type ComponentProps, type FocusEvent, type MouseEvent, type TouchEvent } from "react";

type LinkProps = ComponentProps<typeof Link>;

/**
 * 意图触发预取的 Link：进入视口不预取，悬停／焦点／触摸后再恢复默认预取。
 * 用于首页海报轨、横滑卡等“可见但未必会点”的大列表，避免一次拉很多详情 RSC。
 * 显式传入 prefetch={false} 时始终关闭预取（例如管理入口）。
 */
export default function HoverPrefetchLink({ prefetch, onMouseEnter, onFocus, onTouchStart, ...props }: LinkProps) {
  const [intent, setIntent] = useState(false);
  const prefetchDisabled = prefetch === false;

  /** 标记用户意图，并保留调用方原有事件处理。 */
  const markIntent = () => {
    if (!prefetchDisabled) setIntent(true);
  };

  return (
    <Link
      {...props}
      prefetch={prefetchDisabled ? false : intent ? (prefetch ?? null) : false}
      onMouseEnter={(event: MouseEvent<HTMLAnchorElement>) => {
        markIntent();
        onMouseEnter?.(event);
      }}
      onFocus={(event: FocusEvent<HTMLAnchorElement>) => {
        markIntent();
        onFocus?.(event);
      }}
      onTouchStart={(event: TouchEvent<HTMLAnchorElement>) => {
        markIntent();
        onTouchStart?.(event);
      }}
    />
  );
}
