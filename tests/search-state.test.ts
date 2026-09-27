import { expect, test } from "vitest";
import { buildMediaSearchQuery, hasOnlyKnownFilterValues } from "@/lib/api/search-state";
import { parseMediaSearchParams } from "@/lib/api/media-params";

test("server and browser query conversion preserves all search categories", /* 验证服务端与浏览器共用的转换函数保留分类、状态、属性、年份及分页条件。 */ () => {
  const query = buildMediaSearchQuery(new URLSearchParams({
    q: " 王家卫 ", type: "movie,tv_show,director,actor,series", status: "watched,want_to_watch,watching",
    genre: "剧情,喜剧", region: "香港", language: "粤语", startYear: "1990", endYear: "2025",
    sort: "rating_desc", page: "2",
  }));
  expect(parseMediaSearchParams(new URLSearchParams(query))).toEqual({
    q: "王家卫", type: "movie,tv_show", creditRole: "director,actor", seriesOnly: true,
    status: "watched,want_to_watch,watching", genre: "剧情,喜剧", region: "香港", language: "粤语",
    startYear: "1990", endYear: "2025", sort: "rating_desc", limit: 30, offset: 30, upcoming: false,
  });
});

test("the upcoming status option becomes a separate API flag", /* 验证“即将上映”状态选项转换为独立的 upcoming 参数，不混入观看状态。 */ () => {
  expect(hasOnlyKnownFilterValues(new URLSearchParams({ status: "upcoming,want_to_watch" }))).toBe(true);
  const params = parseMediaSearchParams(new URLSearchParams(buildMediaSearchQuery(new URLSearchParams({ status: "upcoming,want_to_watch" }))));
  expect(params.status).toBe("want_to_watch");
  expect(params.upcoming).toBe(true);
});

test.each(["-1", "NaN", "Infinity", "1.5"])("invalid page %s uses the first page", /* 对每个非法页码验证 API 偏移量回退为零。 */ (page) => {
  expect(new URLSearchParams(buildMediaSearchQuery(new URLSearchParams({ page }))).get("offset")).toBe("0");
});

test.each<Record<string, string>>([
  { type: "电影" },
  { type: "tv_series" },
  { status: "已看" },
  { sort: "评分" },
])("unknown filter values %o are rejected", /* 验证分类、状态和排序中的旧版中文值与未知值都判定为无效地址。 */ (params) => {
  expect(hasOnlyKnownFilterValues(new URLSearchParams(params))).toBe(false);
});

test("canonical filter values and free-text attributes are accepted", /* 验证规范值通过校验，类型、地区等属性的中文取值不受影响。 */ () => {
  expect(hasOnlyKnownFilterValues(new URLSearchParams({
    q: "王家卫", type: "movie,tv_show,series", status: "watched", sort: "rating_desc", genre: "剧情", region: "香港",
  }))).toBe(true);
});
