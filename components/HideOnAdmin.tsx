"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** 管理区有自己的侧栏。公开站的顶栏、页脚和底部标签在这里叠在一起，进入 /manage 与 /settings 时卸掉。 */
export default function HideOnAdmin({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/manage") || pathname?.startsWith("/settings")) return null;
  return children;
}
