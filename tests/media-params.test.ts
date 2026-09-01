import assert from "node:assert/strict";
import { test } from "vitest";
import {
  ApiValidationError,
  parseMediaSearchParams,
  parseTopMediaParams,
} from "../lib/api/media-params.ts";

test("parses and clamps valid media search parameters", () => {
  const params = parseMediaSearchParams(new URLSearchParams({
    q: "科幻",
    type: "movie,tv_series",
    status: "watched,watching",
    sort: "rating_desc",
    startYear: "2020",
    endYear: "2024",
    limit: "999",
    offset: "-1",
  }));

  assert.equal(params.q, "科幻");
  assert.equal(params.type, "movie,tv_series");
  assert.equal(params.limit, 100);
  assert.equal(params.offset, 0);
});

test("rejects invalid filter values and reversed year ranges", () => {
  assert.throws(
    () => parseMediaSearchParams(new URLSearchParams({ type: "documentary" })),
    ApiValidationError,
  );
  assert.throws(
    () => parseMediaSearchParams(new URLSearchParams({ startYear: "2025", endYear: "2024" })),
    /Start year/,
  );
});

test("validates top-media type, year, and limit", () => {
  assert.deepEqual(
    parseTopMediaParams(new URLSearchParams({ type: "tv_series", year: "2024", limit: "20" })),
    { type: "tv_series", year: "2024", limit: 20 },
  );
  assert.throws(
    () => parseTopMediaParams(new URLSearchParams({ type: "movie", year: "all" })),
    ApiValidationError,
  );
  assert.throws(
    () => parseTopMediaParams(new URLSearchParams({ type: "tv_series", year: "0000" })),
    ApiValidationError,
  );
  assert.throws(
    () => parseTopMediaParams(new URLSearchParams({
      type: "tv_series",
      year: String(new Date().getUTCFullYear() + 6),
    })),
    ApiValidationError,
  );
});
