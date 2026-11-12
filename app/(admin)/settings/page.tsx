import { requireOwner } from "@/lib/auth/server";
import PageHeader, { AdminCrumb } from "../PageHeader";
import PasskeySettings from "./PasskeySettings";

/** 在服务端验证站长身份后展示凭证元数据，不返回任何私钥。 */
export default async function SecurityPage() {
  const { db } = await requireOwner();
  const { data, error } = await db.auth.passkey.list();
  return <section className="admin-form-page">
    <PageHeader eyebrow={<AdminCrumb current="账号安全" />} title="Passkey 设置" description="为常用设备添加凭证，建议另备一个独立凭证。登录时无需输入邮箱。" />
    <PasskeySettings initialKeys={data ?? []} initialError={error ? "无法读取凭证，请确认 Supabase 已启用 Passkey。" : ""} />
  </section>;
}
