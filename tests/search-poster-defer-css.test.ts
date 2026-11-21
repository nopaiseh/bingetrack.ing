import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("search media card content-visibility", () => {
  it("locks card height with content-visibility and contain-intrinsic-size", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
    const block = css.match(/\.search-media-card\s*\{[^}]*\}/);
    expect(block?.[0]).toBeTruthy();
    expect(block![0]).toContain("content-visibility: auto");
    expect(block![0]).toContain("contain-intrinsic-size: auto 380px");
  });
});
