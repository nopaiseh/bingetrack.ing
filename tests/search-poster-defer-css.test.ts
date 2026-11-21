import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("search media card content-visibility", () => {
  const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

  it("locks card height with content-visibility and auto contain-intrinsic-size", () => {
    const block = css.match(/\.search-media-card\s*\{[^}]*\}/);
    expect(block?.[0]).toBeTruthy();
    expect(block![0]).toContain("content-visibility: auto");
    expect(block![0]).toContain("contain-intrinsic-size: auto 377px");
  });

  it("uses responsive contain-intrinsic-size estimates matching measured card heights", () => {
    // Measured on production search grid (film 2:3 + body): 390→376.5, 640→397,
    // 768→457, 1024→454.5, 1280/1440→396. Rounded estimates + `auto` remember size.
    expect(css).toMatch(/\.search-media-card\s*\{[^}]*contain-intrinsic-size:\s*auto 377px/);
    expect(css).toMatch(
      /@media\s*\(min-width:\s*640px\)\s*\{\s*\.search-media-card\s*\{[^}]*contain-intrinsic-size:\s*auto 397px/,
    );
    expect(css).toMatch(
      /@media\s*\(min-width:\s*768px\)\s*\{\s*\.search-media-card\s*\{[^}]*contain-intrinsic-size:\s*auto 457px/,
    );
    expect(css).toMatch(
      /@media\s*\(min-width:\s*1024px\)\s*\{\s*\.search-media-card\s*\{[^}]*contain-intrinsic-size:\s*auto 455px/,
    );
    expect(css).toMatch(
      /@media\s*\(min-width:\s*1280px\)\s*\{\s*\.search-media-card\s*\{[^}]*contain-intrinsic-size:\s*auto 396px/,
    );
    expect(css).not.toContain("contain-intrinsic-size: auto 380px");
  });
});
