import assert from "node:assert/strict";
import { test } from "vitest";
import { buildMediaDistributions, type DistributionCountRow } from "../lib/functions/media-distributions.ts";

test(
  "builds top-five distributions and percentages from database counts",
  /* 用固定数据库计数验证前五名排序与百分比计算。 */ () => {
    const rows: DistributionCountRow[] = [
      { media_type: "movies", release_year: "All Time", dimension: "regions", name: "美国", item_count: 6 },
      { media_type: "movies", release_year: "All Time", dimension: "regions", name: "香港", item_count: 4 },
      { media_type: "movies", release_year: "2024", dimension: "genres", name: "剧情", item_count: 3 },
      { media_type: "movies", release_year: "2024", dimension: "genres", name: "动作", item_count: 1 },
      { media_type: "shows", release_year: "2024", dimension: "languages", name: "韩语", item_count: 2 },
      { media_type: "albums", release_year: "All Time", dimension: "genres", name: "流行", item_count: 5 },
      { media_type: "albums", release_year: "2024", dimension: "genres", name: "摇滚", item_count: 2 },
      { media_type: "books", release_year: "All Time", dimension: "languages", name: "汉语", item_count: 3 },
      { media_type: "books", release_year: "2023", dimension: "genres", name: "小说", item_count: 4 },
      { media_type: "books", release_year: "2023", dimension: "genres", name: "随笔", item_count: 1 },
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
    assert.deepEqual(distributions.shows["2024"].languages, [{ name: "韩语", count: 2, percent: 100 }]);
    assert.deepEqual(distributions.albums["All Time"].genres, [{ name: "流行", count: 5, percent: 100 }]);
    assert.deepEqual(distributions.albums["2024"].genres, [{ name: "摇滚", count: 2, percent: 100 }]);
    assert.deepEqual(distributions.books["All Time"].languages, [{ name: "汉语", count: 3, percent: 100 }]);
    assert.deepEqual(distributions.books["2023"].genres, [
      { name: "小说", count: 4, percent: 80 },
      { name: "随笔", count: 1, percent: 20 },
    ]);
  },
);

test(
  "always supplies empty All Time buckets",
  /* 验证无数据时仍为各公开媒体类型提供空 All Time 分组。 */ () => {
    const distributions = buildMediaDistributions([]);
    assert.deepEqual(distributions.movies["All Time"], { regions: [], languages: [], genres: [] });
    assert.deepEqual(distributions.shows["All Time"], { regions: [], languages: [], genres: [] });
    assert.deepEqual(distributions.albums["All Time"], { regions: [], languages: [], genres: [] });
    assert.deepEqual(distributions.books["All Time"], { regions: [], languages: [], genres: [] });
  },
);
