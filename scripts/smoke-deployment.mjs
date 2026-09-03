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

const failures = [];

for (const check of checks) {
  const url = new URL(check.path, baseUrl);

  try {
    const response = await fetch(url, {
      headers: protectionBypassSecret
        ? { "x-vercel-protection-bypass": protectionBypassSecret }
        : undefined,
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok) {
      failures.push(`${url}: HTTP ${response.status}`);
    } else if (!contentType.includes(check.expectedContentType)) {
      failures.push(
        `${url}: expected ${check.expectedContentType}, received ${contentType || "no content type"}`,
      );
    } else if (
      check.requiredHeaders?.some((name) => !response.headers.has(name))
    ) {
      const missingHeaders = check.requiredHeaders.filter(
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
