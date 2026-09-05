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
  { name: "movies", path: "/movies" },
  { name: "series", path: "/series" },
];

function configuredPath(name, expectedPrefix) {
  const value = process.env[name];
  if (!value) return null;
  if (!value.startsWith(`${expectedPrefix}/`) || value.includes("://")) {
    throw new Error(`${name} must be a local path beginning with ${expectedPrefix}/`);
  }
  return value;
}

async function fetchHtml(path) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) throw new Error(`Unable to discover Lighthouse sample from ${path}: ${response.status}`);
  return response.text();
}

function firstHref(html, pattern) {
  return html.match(pattern)?.[1]?.replaceAll("&amp;", "&") ?? null;
}

async function addDynamicRoutes() {
  const moviesHtml = await fetchHtml("/movies");
  const seriesHtml = await fetchHtml("/series");
  const moviePath = configuredPath("LIGHTHOUSE_MOVIE_PATH", "/movies")
    ?? firstHref(moviesHtml, /href="(\/movies\/[^"?#]+(?:\?[^"#]*)?)"/);
  const seriesPath = configuredPath("LIGHTHOUSE_SERIES_PATH", "/series")
    ?? firstHref(seriesHtml, /href="(\/series\/[^"?#]+(?:\?[^"#]*)?)"/);

  if (!moviePath || !seriesPath) {
    throw new Error("Could not discover movie and series detail samples. Set LIGHTHOUSE_MOVIE_PATH and LIGHTHOUSE_SERIES_PATH.");
  }

  routes.push(
    { name: "movie-detail", path: moviePath },
    { name: "series-detail", path: seriesPath },
  );

  const seasonPath = configuredPath("LIGHTHOUSE_SEASON_PATH", `${seriesPath.split("?")[0]}/seasons`)
    ?? firstHref(await fetchHtml(seriesPath), /href="(\/series\/[^"?#]+\/seasons\/[^"?#]+(?:\?[^"#]*)?)"/);
  if (!seasonPath) {
    throw new Error("Could not discover a season detail sample. Set LIGHTHOUSE_SEASON_PATH.");
  }
  routes.push({ name: "season-detail", path: seasonPath });
}

const budgets = {
  performance: { maximum: 0.9, higherIsBetter: true },
  "first-contentful-paint": { maximum: 1_800 },
  "largest-contentful-paint": { maximum: 2_500 },
  "total-blocking-time": { maximum: 200 },
  "cumulative-layout-shift": { maximum: 0.1 },
};

mkdirSync(outputDirectory, { recursive: true });
await addDynamicRoutes();

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
