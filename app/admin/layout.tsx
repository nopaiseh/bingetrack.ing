import Link from "next/link";
import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/server";
import { signOut } from "./actions";
import "./admin.css";

export const metadata: Metadata = { title: "管理", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** 管理页面入口检查身份；所有 Server Action 仍须独立检查权限。 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return <div className="admin-shell mx-auto w-full max-w-6xl px-4 pb-10 pt-24 sm:px-6">
    <nav aria-label="管理导航" className="mb-10 flex flex-wrap items-center gap-5 border-b border-white/10 pb-5">
      <Link href="/admin" className="font-semibold text-white">媒体管理</Link>
      <Link href="/admin/security">Passkey 设置</Link>
      <Link href="/">浏览网站</Link>
      <form action={signOut} className="ml-auto"><button type="submit">退出登录</button></form>
    </nav>
    {children}
  </div>;
}
