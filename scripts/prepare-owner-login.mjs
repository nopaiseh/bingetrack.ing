import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// 手动运维工具：通过 Admin API 创建指定账号或为已有账号生成一次性链接，不发送邮件。
const email = process.env.OWNER_EMAIL?.trim();
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!email || !secret || !supabaseUrl || !siteUrl) {
  throw new Error("请在忽略提交的 .env.admin 中配置 OWNER_EMAIL、SUPABASE_SECRET_KEY、NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SITE_URL。");
}
const origin = new URL(siteUrl).origin;
if (!origin.startsWith("https://") && !["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("站点必须使用 HTTPS。");
const db = createClient(supabaseUrl, secret, { auth: { persistSession: false, autoRefreshToken: false } });

/** 分页定位指定账号，避免在账号已存在时生成另一个身份。 */
async function findUser() {
  for (let page = 1; ; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error("无法读取 Auth 用户，请检查运维密钥和项目地址。");
    const user = data.users.find(/* 按邮箱精确匹配指定账号。 */ user => user.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 100) return null;
  }
}

const owner = await db.from("site_owner").select("user_id").eq("singleton", true).maybeSingle();
if (owner.error) throw new Error("请先应用 single-owner-admin.sql。");
let user = await findUser();
if (owner.data && owner.data.user_id !== user?.id) throw new Error("数据库已配置其他站长；工具不会创建额外账号或替换现有站长。");
if (!user) {
  if (!process.argv.includes("--create")) throw new Error("账号不存在。首次创建请显式加 --create。");
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error("创建账号失败，请检查 Supabase 配置。");
  user = data.user;
}
if (!user.email_confirmed_at) throw new Error("请先在 Supabase 后台确认该账号的邮箱。");

if (!owner.data) {
  if (!process.argv.includes("--create")) throw new Error("站长尚未指定，首次初始化请显式加 --create。");
  const { error } = await db.from("site_owner").insert({ singleton: true, user_id: user.id });
  if (error) throw new Error("配置站长失败，请检查数据库权限。");
}

const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
if (error || !data.properties?.hashed_token) throw new Error("生成一次性登录链接失败。");
const link = new URL("/auth/confirm", origin);
link.searchParams.set("token_hash", data.properties.hashed_token);
link.searchParams.set("type", "magiclink");
// 链接等同临时登录凭证：只写入忽略提交且权限受限的本地文件，不输出到日志。
const directory = resolve(".local-admin");
await mkdir(directory, { recursive: true, mode: 0o700 });
await writeFile(resolve(directory, "login-link.txt"), `${link}\n`, { mode: 0o600 });
console.log("站长账号已准备，一次性登录链接保存在 .local-admin/login-link.txt。使用后请删除该文件。");
