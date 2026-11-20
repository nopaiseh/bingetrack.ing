import { pathToFileURL } from "node:url";

const ALWAYS_REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];

/** @typedef {Record<string, string | undefined>} EnvMap */

/**
 * 返回当前环境缺失的必需变量名（未设置或只有空白）。
 * 生产额外要求 NEXT_PUBLIC_SITE_URL，以及活动 Cookie 签名密钥材料。
 * @param {EnvMap} [env]
 */
export function missingRequiredVariables(env = process.env) {
  const required = [
    ...ALWAYS_REQUIRED,
    // 生产部署的规范地址、站点地图和 Passkey 依赖正式站点地址，不能静默回退到内置域名。
    ...(env.VERCEL_ENV === "production" ? ["NEXT_PUBLIC_SITE_URL"] : []),
  ];
  return required.filter((name) => !env[name]?.trim());
}

/**
 * 生产环境签发空闲活动 Cookie 需要签名密钥材料：
 * SUPABASE_SECRET_KEY 或 SUPABASE_SERVICE_ROLE_KEY 至少设一个（非空白）。
 * 预览与本地不强制。返回需要写入错误信息的变量名列表；已满足时返回空数组。
 * @param {EnvMap} [env]
 */
export function missingProductionActivitySecretNames(env = process.env) {
  if (env.VERCEL_ENV !== "production") return [];
  const hasSecret = Boolean(env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  if (hasSecret) return [];
  return ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
}

/**
 * 校验已设置的 URL 类变量是否为绝对地址；返回错误文案（只含变量名）。
 * @param {EnvMap} [env]
 */
export function invalidAbsoluteUrlMessages(env = process.env) {
  const messages = [];
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SITE_URL"]) {
    if (!env[name]) continue;
    try {
      new URL(env[name]);
    } catch {
      messages.push(`${name} must be a valid absolute URL.`);
    }
  }
  return messages;
}

/**
 * 汇总环境检查问题文案；无问题时返回空数组。错误信息只含变量名，不含值。
 * @param {EnvMap} [env]
 */
export function environmentCheckMessages(env = process.env) {
  const messages = [];
  const missing = missingRequiredVariables(env);
  if (missing.length > 0) {
    messages.push(`Missing required environment variables: ${missing.join(", ")}`);
  }
  const activitySecrets = missingProductionActivitySecretNames(env);
  if (activitySecrets.length > 0) {
    messages.push(
      `Missing required environment variables: set ${activitySecrets.join(" or ")} (at least one, non-empty)`,
    );
  }
  messages.push(...invalidAbsoluteUrlMessages(env));
  return messages;
}

/**
 * @param {EnvMap} [env]
 * @param {{ error: (...args: unknown[]) => void; log: (...args: unknown[]) => void }} [io]
 */
export function runEnvironmentCheck(env = process.env, io = console) {
  const messages = environmentCheckMessages(env);
  if (messages.length > 0) {
    for (const message of messages) io.error(message);
    return 1;
  }
  io.log("Required application environment variables are present.");
  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.exit(runEnvironmentCheck());
}
