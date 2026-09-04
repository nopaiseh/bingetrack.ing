import { mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const baseUrl = (process.argv.find((argument) => argument.startsWith("http")) ?? "http://localhost:3000").replace(/\/$/, "");
const enforceBudgets = process.argv.includes("--enforce");
const outputDirectory = resolve(".lighthouse");
const lighthouseBinary = resolve("node_modules/.bin/lighthouse");

const routes = [
  { name: "home", path: "/" },
  { name: "search", path: "/search" },
];

const budgets = {
  performance: { maximum: 0.9, higherIsBetter: true },
  "first-contentful-paint": { maximum: 1_800 },
  "largest-contentful-paint": { maximum: 2_500 },
  "total-blocking-time": { maximum: 200 },
  "cumulative-layout-shift": { maximum: 0.1 },
};

mkdirSync(outputDirectory, { recursive: true });

let hasBudgetFailure = false;
for (const route of routes) {
  const outputPath = resolve(outputDirectory, `${route.name}.json`);
  const result = spawnSync(
    lighthouseBinary,
    [`${baseUrl}${route.path}`, "--quiet", "--chrome-flags=--headless", "--only-categories=performance", "--output=json", `--output-path=${outputPath}`],
    { encoding: "utf8", stdio: "inherit" },
  );

  if (result.status !== 0) process.exit(result.status ?? 1);

  const report = JSON.parse(readFileSync(outputPath, "utf8"));
  const values = {
    performance: report.categories.performance.score,
    "first-contentful-paint": report.audits["first-contentful-paint"].numericValue,
    "largest-contentful-paint": report.audits["largest-contentful-paint"].numericValue,
    "total-blocking-time": report.audits["total-blocking-time"].numericValue,
    "cumulative-layout-shift": report.audits["cumulative-layout-shift"].numericValue,
  };

  console.log(`\n${route.name} (${baseUrl}${route.path})`);
  for (const [metric, value] of Object.entries(values)) {
    const budget = budgets[metric];
    const passes = budget.higherIsBetter ? value >= budget.maximum : value <= budget.maximum;
    hasBudgetFailure ||= !passes;
    const renderedValue = metric === "performance" ? Math.round(value * 100) : Math.round(value * 100) / 100;
    console.log(`${passes ? "PASS" : "FAIL"} ${metric}: ${renderedValue}`);
  }
}

if (enforceBudgets && hasBudgetFailure) process.exit(1);
