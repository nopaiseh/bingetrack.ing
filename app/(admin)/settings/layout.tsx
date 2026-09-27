import type { Metadata } from "next";

export const metadata: Metadata = { title: "设置", robots: { index: false, follow: false } };

/** 设置保留独立地址 /settings，外框与身份检查在 (admin)/layout.tsx，与管理区共用侧栏。 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
