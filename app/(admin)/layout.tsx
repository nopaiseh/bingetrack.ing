import { Suspense } from "react";
import { cookies } from "next/headers";
import { requireOwner } from "@/lib/auth/server";
import "./manage/admin.css";
import ManageNav from "./manage/ManageNav";
import { NAV_COOKIE } from "@/lib/admin/navigation";
import AdminFrame from "./AdminFrame";

export const dynamic = "force-dynamic";

/** 管理区与账号安全共用外框：侧栏在两者之间切换时保持挂载。入口检查身份，所有 Server Action 仍须独立检查权限。 */
export default async function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  const collapsed = (await cookies()).get(NAV_COOKIE)?.value === "collapsed";
  return <div className="admin-shell relative mx-auto w-full max-w-7xl px-4 pb-12 pt-24 text-neutral-200 sm:px-6 lg:px-8">
    <AdminFrame initialCollapsed={collapsed} nav={<Suspense><ManageNav /></Suspense>}>{children}</AdminFrame>
  </div>;
}
