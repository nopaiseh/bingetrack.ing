import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/server";
import "../manage/admin.css";

export const metadata: Metadata = { title: "设置", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** 设置独立于管理路由，仍在服务端验证站长身份。 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return <div className="admin-shell relative mx-auto w-full max-w-7xl px-4 pb-12 pt-24 text-neutral-200 sm:px-6 lg:px-8">{children}</div>;
}
