import assert from "node:assert/strict";
import { test } from "vitest";
import {
  ApiValidationError,
  parseMediaSearchParams,
  parseTopMediaParams,
} from "../lib/api/media-params.ts";

test("parses and clamps valid media search parameters", /* 验证合法查询参数正确解析，分页数值按允许范围截断。 */ () => {
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

test("rejects invalid filter values and reversed year ranges", /* 验证未知分类和倒置年份范围抛出参数校验错误。 */ () => {
  assert.throws(
    /** 传入不支持的媒体分类以触发校验错误。 */
    () => parseMediaSearchParams(new URLSearchParams({ type: "documentary" })),
    ApiValidationError,
  );
  assert.throws(
    /** 传入起始年份晚于结束年份的范围以触发校验错误。 */
    () => parseMediaSearchParams(new URLSearchParams({ startYear: "2025", endYear: "2024" })),
    /Start year/,
  );
});

test("validates top-media type, year, and limit", /* 验证榜单类型、有效年份和数量解析，以及非法年份拒绝行为。 */ () => {
  assert.deepEqual(
    parseTopMediaParams(new URLSearchParams({ type: "tv_series", year: "2024", limit: "20" })),
    { type: "tv_series", year: "2024", limit: 20 },
  );
  assert.throws(
    /** 传入非年份文本以验证榜单参数拒绝该值。 */
    () => parseTopMediaParams(new URLSearchParams({ type: "movie", year: "all" })),
    ApiValidationError,
  );
  assert.throws(
    /** 传入低于支持范围的年份以验证校验失败。 */
    () => parseTopMediaParams(new URLSearchParams({ type: "tv_series", year: "0000" })),
    ApiValidationError,
  );
  assert.throws(
    /** 传入超过当前年份六年的值以验证上界限制。 */
    () => parseTopMediaParams(new URLSearchParams({
      type: "tv_series",
      year: String(new Date().getUTCFullYear() + 6),
    })),
    ApiValidationError,
  );
});
