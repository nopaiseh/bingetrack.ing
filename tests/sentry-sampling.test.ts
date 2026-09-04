import assert from "node:assert/strict";
import { test } from "vitest";
import {
  getDefaultSentryTracesSampleRate,
  parseSentryTracesSampleRate,
} from "../lib/sentry-sampling.ts";

test("uses environment-appropriate trace sampling defaults", () => {
  assert.equal(getDefaultSentryTracesSampleRate("production"), 0.1);
  assert.equal(getDefaultSentryTracesSampleRate("development"), 1);
  assert.equal(getDefaultSentryTracesSampleRate("test"), 1);
});

test("accepts finite trace sample rates from zero through one", () => {
  assert.equal(parseSentryTracesSampleRate("0", 0.5), 0);
  assert.equal(parseSentryTracesSampleRate("0.25", 0.5), 0.25);
  assert.equal(parseSentryTracesSampleRate("1", 0.5), 1);
});

test("falls back for empty, non-numeric, or out-of-range values", () => {
  for (const value of [undefined, "", " ", "invalid", "NaN", "Infinity", "-0.1", "1.1"]) {
    assert.equal(parseSentryTracesSampleRate(value, 0.25), 0.25);
  }
});
