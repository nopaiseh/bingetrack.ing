import { describe, expect, it } from "vitest";
import { formatCompactCount, normalizeCount } from "@/lib/format-compact-count";

describe("normalizeCount", () => {
  it("把非有限、负数与小数收成非负整数", () => {
    expect(normalizeCount(NaN)).toBe(0);
    expect(normalizeCount(Infinity)).toBe(0);
    expect(normalizeCount(-3)).toBe(0);
    expect(normalizeCount(0)).toBe(0);
    expect(normalizeCount(12.9)).toBe(12);
  });
});

describe("formatCompactCount", () => {
  it("不足一千显示原整数", () => {
    expect(formatCompactCount(0)).toBe("0");
    expect(formatCompactCount(1)).toBe("1");
    expect(formatCompactCount(999)).toBe("999");
  });

  it("一千到九千九百九十九用千，一位小数向下截断并去掉 .0", () => {
    expect(formatCompactCount(1000)).toBe("1千");
    expect(formatCompactCount(1001)).toBe("1千");
    expect(formatCompactCount(1099)).toBe("1千");
    expect(formatCompactCount(1100)).toBe("1.1千");
    expect(formatCompactCount(1250)).toBe("1.2千");
    expect(formatCompactCount(1999)).toBe("1.9千");
    expect(formatCompactCount(9999)).toBe("9.9千");
  });

  it("一万到不足一亿用万", () => {
    expect(formatCompactCount(10_000)).toBe("1万");
    expect(formatCompactCount(12_000)).toBe("1.2万");
    expect(formatCompactCount(35_000)).toBe("3.5万");
    expect(formatCompactCount(120_000)).toBe("12万");
    expect(formatCompactCount(999_999)).toBe("99.9万");
    expect(formatCompactCount(1_000_000)).toBe("100万");
    expect(formatCompactCount(99_999_999)).toBe("9999.9万");
  });

  it("一亿及以上用亿", () => {
    expect(formatCompactCount(100_000_000)).toBe("1亿");
    expect(formatCompactCount(120_000_000)).toBe("1.2亿");
    expect(formatCompactCount(1_250_000_000)).toBe("12.5亿");
  });

  it("边界：999／1000／9999／10000／99999999／100000000", () => {
    expect(formatCompactCount(999)).toBe("999");
    expect(formatCompactCount(1000)).toBe("1千");
    expect(formatCompactCount(9999)).toBe("9.9千");
    expect(formatCompactCount(10_000)).toBe("1万");
    expect(formatCompactCount(99_999_999)).toBe("9999.9万");
    expect(formatCompactCount(100_000_000)).toBe("1亿");
  });
});
