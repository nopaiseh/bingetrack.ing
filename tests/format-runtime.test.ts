import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { formatRuntime, parseRuntimeParts } from "../lib/format-runtime.ts";

describe("parseRuntimeParts", () => {
  it("returns zero parts for null, undefined, NaN, and non-positive numbers", () => {
    assert.deepEqual(parseRuntimeParts(null), { days: 0, hours: 0, minutes: 0, totalMinutes: 0 });
    assert.deepEqual(parseRuntimeParts(undefined), { days: 0, hours: 0, minutes: 0, totalMinutes: 0 });
    assert.deepEqual(parseRuntimeParts(NaN), { days: 0, hours: 0, minutes: 0, totalMinutes: 0 });
    assert.deepEqual(parseRuntimeParts(0), { days: 0, hours: 0, minutes: 0, totalMinutes: 0 });
    assert.deepEqual(parseRuntimeParts(-45), { days: 0, hours: 0, minutes: 0, totalMinutes: 0 });
  });

  it("correctly decomposes minutes into days, hours, and minutes", () => {
    assert.deepEqual(parseRuntimeParts(45), { days: 0, hours: 0, minutes: 45, totalMinutes: 45 });
    assert.deepEqual(parseRuntimeParts(60), { days: 0, hours: 1, minutes: 0, totalMinutes: 60 });
    assert.deepEqual(parseRuntimeParts(95.4), { days: 0, hours: 1, minutes: 35, totalMinutes: 95 });
    assert.deepEqual(parseRuntimeParts(1440), { days: 1, hours: 0, minutes: 0, totalMinutes: 1440 });
    assert.deepEqual(parseRuntimeParts(1500), { days: 1, hours: 1, minutes: 0, totalMinutes: 1500 });
    assert.deepEqual(parseRuntimeParts(1525), { days: 1, hours: 1, minutes: 25, totalMinutes: 1525 });
    assert.deepEqual(parseRuntimeParts(2900), { days: 2, hours: 0, minutes: 20, totalMinutes: 2900 });
  });
});

describe("formatRuntime", () => {
  it("returns null or fallbackZero for non-positive or invalid input", () => {
    assert.equal(formatRuntime(null), null);
    assert.equal(formatRuntime(undefined), null);
    assert.equal(formatRuntime(NaN), null);
    assert.equal(formatRuntime(0), null);
    assert.equal(formatRuntime(-10), null);

    assert.equal(formatRuntime(null, true), "0 分钟");
    assert.equal(formatRuntime(undefined, true), "0 分钟");
    assert.equal(formatRuntime(0, true), "0 分钟");
    assert.equal(formatRuntime(-5, true), "0 分钟");
  });

  it("formats pure minutes", () => {
    assert.equal(formatRuntime(45), "45 分钟");
    assert.equal(formatRuntime(1), "1 分钟");
  });

  it("formats hours and minutes omitting zero units", () => {
    assert.equal(formatRuntime(60), "1 小时");
    assert.equal(formatRuntime(90), "1 小时 30 分钟");
    assert.equal(formatRuntime(125), "2 小时 5 分钟");
  });

  it("formats days, hours, and minutes omitting zero units", () => {
    assert.equal(formatRuntime(1440), "1 天");
    assert.equal(formatRuntime(1500), "1 天 1 小时");
    assert.equal(formatRuntime(1525), "1 天 1 小时 25 分钟");
    assert.equal(formatRuntime(2900), "2 天 20 分钟");
  });
});

