import assert from "node:assert/strict";
import test from "node:test";
import { buildMediaDistributions, type DistributionCountRow } from "../lib/functions/media-distributions.ts";

test("builds top-five distributions and percentages from database counts", () => {
  const rows: DistributionCountRow[] = [
    { media_type: "movies", release_year: "All Time", dimension: "regions", name: "美国", item_count: 6 },
    { media_type: "movies", release_year: "All Time", dimension: "regions", name: "香港", item_count: 4 },
    { media_type: "movies", release_year: "2024", dimension: "genres", name: "剧情", item_count: 3 },
    { media_type: "movies", release_year: "2024", dimension: "genres", name: "动作", item_count: 1 },
    { media_type: "series", release_year: "2024", dimension: "languages", name: "韩语", item_count: 2 },
  ];

  const distributions = buildMediaDistributions(rows);

  assert.deepEqual(distributions.movies["All Time"].regions, [
    { name: "美国", count: 6, percent: 60 },
    { name: "香港", count: 4, percent: 40 },
  ]);
  assert.deepEqual(distributions.movies["2024"].genres, [
    { name: "剧情", count: 3, percent: 75 },
    { name: "动作", count: 1, percent: 25 },
  ]);
  assert.deepEqual(distributions.series["2024"].languages, [
    { name: "韩语", count: 2, percent: 100 },
  ]);
});

test("always supplies empty All Time buckets", () => {
  const distributions = buildMediaDistributions([]);
  assert.deepEqual(distributions.movies["All Time"], { regions: [], languages: [], genres: [] });
  assert.deepEqual(distributions.series["All Time"], { regions: [], languages: [], genres: [] });
});
