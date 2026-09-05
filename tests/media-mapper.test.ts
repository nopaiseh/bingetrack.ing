import assert from "node:assert/strict";
import { test } from "vitest";
import { mapViewRowToMedia, mapViewRowToMediaCard } from "../lib/functions/media-mapper.ts";

test("normalizes media type and sorts cloned metadata arrays", () => {
  const genres = ["科幻 10", "动作", "科幻 2"];
  const media = mapViewRowToMedia({
    id: "movie-1",
    title: "Test",
    type: "movie",
    release_year: "2024",
    genres,
    languages: ["英语", "华语"],
    regions: null,
    series: ["系列 10", "系列 2"],
  });

  assert.equal(media.type, "movies");
  assert.deepEqual(media.genres, ["动作", "科幻 2", "科幻 10"]);
  assert.deepEqual(media.series, ["系列 2", "系列 10"]);
  assert.deepEqual(genres, ["科幻 10", "动作", "科幻 2"]);
});

test("honors mapped type and series overrides", () => {
  const media = mapViewRowToMedia(
    { id: 42, type: "movie", title: null },
    ["B", "A"],
    "series",
  );

  assert.equal(media.id, "42");
  assert.equal(media.type, "series");
  assert.deepEqual(media.series, ["A", "B"]);
});

test("card mapping preserves display fields and excludes detail payloads", () => {
  const row = { id: 42, type: "tv_series", title: "Series", sort_date: "2020-01-01",
    release_year: "2020 - 2026", rating: 8, genres: ["B", "A"], languages: ["English"],
    summary: "Long summary", casts: ["Actor"], directors: ["Director"], runtime: 4000 };
  const card = mapViewRowToMediaCard(row);
  const full = mapViewRowToMedia(row);
  for (const key of Object.keys(card) as Array<keyof typeof card>) assert.deepEqual(card[key], full[key]);
  for (const key of ["summary", "casts", "directors", "runtime", "regions", "series"]) assert.equal(key in card, false);
});
