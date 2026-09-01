import assert from "node:assert/strict";
import { test } from "vitest";
import { mapViewRowToMedia } from "../lib/functions/media-mapper.ts";

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
