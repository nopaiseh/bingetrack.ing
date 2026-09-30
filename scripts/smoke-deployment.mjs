const deploymentUrl = process.env.DEPLOYMENT_URL;
const protectionBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

if (!deploymentUrl) {
  console.error("DEPLOYMENT_URL is required, for example https://www.bingetrack.ing");
  process.exit(1);
}

const baseUrl = new URL(deploymentUrl);
const checks = [
  {
    path: "/",
    expectedContentType: "text/html",
    requiredHeaders: [
      "content-security-policy",
      "x-content-type-options",
      "referrer-policy",
    ],
  },
  { path: "/search", expectedContentType: "text/html" },
  { path: "/api/media?q=matrix&limit=1", expectedContentType: "application/json" },
];

// 保护绕过密钥只发给本项目的正式域名和 Vercel 部署域名，DEPLOYMENT_URL 配错或跳转到外站时不会把它带出去。
const TRUSTED_HOST = /^(?:www\.)?bingetrack\.ing$|\.vercel\.app$/;
const MAX_REDIRECTS = 5;

/** 仅对受信任的 HTTPS 地址附带保护绕过请求头。 */
function bypassHeaders(url) {
  return protectionBypassSecret && url.protocol === "https:" && TRUSTED_HOST.test(url.hostname)
    ? { "x-vercel-protection-bypass": protectionBypassSecret }
    : undefined;
}

/** 手动跟随跳转，每一跳重新判断是否附带密钥。 */
async function fetchFollowingRedirects(start) {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(url, {
      headers: bypassHeaders(url),
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) return response;
    url = new URL(location, url);
  }
  throw new Error(`more than ${MAX_REDIRECTS} redirects`);
}

const failures = [];

for (const check of checks) {
  const url = new URL(check.path, baseUrl);

  try {
    const response = await fetchFollowingRedirects(url);
    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok) {
      failures.push(`${url}: HTTP ${response.status}`);
    } else if (!contentType.includes(check.expectedContentType)) {
      failures.push(
        `${url}: expected ${check.expectedContentType}, received ${contentType || "no content type"}`,
      );
    } else if (
      check.requiredHeaders?.some(/* 判断响应是否缺少任一必需的 HTTP 头。 */ (name) => !response.headers.has(name))
    ) {
      const missingHeaders = check.requiredHeaders.filter(
        /** 收集缺少的 HTTP 头名称以生成检查错误。 */
        (name) => !response.headers.has(name),
      );
      failures.push(`${url}: missing headers ${missingHeaders.join(", ")}`);
    } else {
      console.log(`PASS ${response.status} ${url}`);
    }
  } catch (error) {
    failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  console.error(`Deployment smoke test failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Deployment smoke test passed for ${baseUrl.origin}.`);
