const requiredVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  // 生产部署的规范地址、站点地图和 Passkey 依赖正式站点地址，不能静默回退到内置域名。
  ...(process.env.VERCEL_ENV === "production" ? ["NEXT_PUBLIC_SITE_URL"] : []),
];

const missingVariables = requiredVariables.filter(
  /** 筛出未设置或只有空白的必需环境变量。 */
  (name) => !process.env[name]?.trim(),
);

if (missingVariables.length > 0) {
  console.error(
    `Missing required environment variables: ${missingVariables.join(", ")}`,
  );
  process.exit(1);
}

for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SITE_URL"]) {
  if (!process.env[name]) continue;
  try {
    new URL(process.env[name]);
  } catch {
    console.error(`${name} must be a valid absolute URL.`);
    process.exit(1);
  }
}

console.log("Required application environment variables are present.");
