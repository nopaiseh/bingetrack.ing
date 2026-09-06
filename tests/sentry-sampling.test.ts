import assert from "node:assert/strict";
import { test } from "vitest";
import {
  getDefaultSentryTracesSampleRate,
  parseSentryTracesSampleRate,
} from "../lib/sentry-sampling.ts";

test("uses environment-appropriate trace sampling defaults", /* 验证生产构建默认性能采样率为 0.1，其余环境为 1。 */ () => {
  assert.equal(getDefaultSentryTracesSampleRate("production"), 0.1);
  assert.equal(getDefaultSentryTracesSampleRate("development"), 1);
  assert.equal(getDefaultSentryTracesSampleRate("test"), 1);
});

test("accepts finite trace sample rates from zero through one", /* 验证零、小数和一均可作为合法性能采样率。 */ () => {
  assert.equal(parseSentryTracesSampleRate("0", 0.5), 0);
  assert.equal(parseSentryTracesSampleRate("0.25", 0.5), 0.25);
  assert.equal(parseSentryTracesSampleRate("1", 0.5), 1);
});

test("falls back for empty, non-numeric, or out-of-range values", /* 验证空值、非数值、无限值和越界值均回退到指定采样率。 */ () => {
  for (const value of [undefined, "", " ", "invalid", "NaN", "Infinity", "-0.1", "1.1"]) {
    assert.equal(parseSentryTracesSampleRate(value, 0.25), 0.25);
  }
});
