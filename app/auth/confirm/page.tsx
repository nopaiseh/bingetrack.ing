import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readConfirmQuery } from "@/lib/auth/confirm-link";

export const dynamic = "force-dynamic";

// 不要把 Referrer-Policy 设成 no-referrer：Chrome 会因此在表单 POST 里发送 Origin: null，同源确认会被拒。
export const metadata: Metadata = {
  title: "确认登录",
  robots: { index: false, follow: false },
};

/** 只展示确认按钮。验证放在 POST，避免链接预览或预取消耗一次性凭证。 */
export default async function ConfirmPage({ searchParams }: {
  searchParams: Promise<{
    token_hash?: string | string[];
    type?: string | string[];
    next?: string | string[];
  }>;
}) {
  const parsed = readConfirmQuery(await searchParams);
  if (!parsed.ok) redirect("/?authError=link");

  return (
    <div className="container mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-6 py-24">
      <section className="surface-panel w-full max-w-lg rounded-2xl p-8 text-center sm:p-12">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">确认登录</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-fg-muted">
          继续后才会验证这封一次性登录链接。
        </p>
        <form method="post" action="/auth/confirm" autoComplete="off" className="mt-8">
          <input type="hidden" name="token_hash" value={parsed.tokenHash} />
          <input type="hidden" name="type" value={parsed.type} />
          <input type="hidden" name="next" value={parsed.next} />
          <button type="submit" className="button-accent inline-flex h-12 w-full items-center justify-center rounded-full px-7 text-sm font-bold active:scale-[0.98]">
            Continue / 继续登录
          </button>
        </form>
      </section>
    </div>
  );
}
