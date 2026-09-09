import { requireOwner } from "@/lib/auth/server";
import PasskeySettings from "./PasskeySettings";

/** 在服务端验证站长身份后展示凭证元数据，不返回任何私钥。 */
export default async function SecurityPage() {
  const { db } = await requireOwner();
  const { data, error } = await db.auth.passkey.list();
  return <section className="max-w-2xl">
    <h1 className="text-3xl font-semibold text-white">Passkey 设置</h1>
    <p className="mt-3 mb-8 text-neutral-400">为常用设备添加凭证，建议另备一个独立凭证。登录时无需输入邮箱。</p>
    <PasskeySettings initialKeys={data ?? []} initialError={error ? "无法读取凭证，请确认 Supabase 已启用 Passkey。" : ""} />
  </section>;
}
