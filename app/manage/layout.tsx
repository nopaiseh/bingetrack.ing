import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/server";
import "./admin.css";
import ManageNav from "./ManageNav";
import { Suspense } from "react";

export const metadata: Metadata = { title: "管理", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** 管理页面入口检查身份；所有 Server Action 仍须独立检查权限。 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return <div className="admin-shell relative mx-auto w-full max-w-7xl px-4 pb-12 pt-24 text-neutral-200 sm:px-6 lg:px-8">
    <div className="grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]"><Suspense><ManageNav /></Suspense><div className="min-w-0">{children}</div></div>
  </div>;
}
