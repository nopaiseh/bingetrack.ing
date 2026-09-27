import type { Metadata } from "next";

export const metadata: Metadata = { title: "管理", robots: { index: false, follow: false } };

/** 外框与身份检查在 (admin)/layout.tsx；这里只提供管理区的页面标题。 */
export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
