import { expect, test } from "vitest";
import { buildMediaSearchQuery } from "@/lib/api/search-state";
import { parseMediaSearchParams } from "@/lib/api/media-params";

test("server and browser query conversion preserves all search categories", () => {
  const query = buildMediaSearchQuery(new URLSearchParams({
    q: " 王家卫 ", type: "电影,电视剧,导演,演员,系列", status: "已看,想看,在看",
    genre: "剧情,喜剧", region: "香港", language: "粤语", startYear: "1990", endYear: "2025",
    sort: "rating_desc", page: "2",
  }));
  expect(parseMediaSearchParams(new URLSearchParams(query))).toEqual({
    q: "王家卫", type: "movie,tv_series", creditRole: "director,actor", seriesOnly: true,
    status: "watched,want_to_watch,watching", genre: "剧情,喜剧", region: "香港", language: "粤语",
    startYear: "1990", endYear: "2025", sort: "rating_desc", limit: 30, offset: 30,
  });
});

test.each(["-1", "NaN", "Infinity", "1.5"])("invalid page %s uses the first page", (page) => {
  expect(new URLSearchParams(buildMediaSearchQuery(new URLSearchParams({ page }))).get("offset")).toBe("0");
});
