import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "站长登录", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** 提供无注册入口的站长登录页。 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <section className="mx-auto w-full max-w-md px-6 py-16 sm:py-24">
    <p className="mb-3 text-sm text-red-300">BINGETRACK.ING</p>
    <h1 className="text-3xl font-semibold text-white">站长登录</h1>
    <p className="mt-3 mb-8 text-neutral-400">使用你的 Passkey，管理影视与观看记录。</p>
    <LoginForm initialError={error === "access" ? "此账号没有管理权限，或站长账号尚未配置。" : error ? "登录链接无效或已过期，请重新获取。" : ""} />
  </section>;
}
