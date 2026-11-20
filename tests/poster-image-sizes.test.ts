import { describe, expect, it } from "vitest";
import {
  ALBUM_COVER_SIZES,
  RAIL_POSTER_SIZES,
  SEARCH_ABOVE_FOLD_COUNT,
  SEARCH_POSTER_SIZES,
} from "../lib/poster-image-sizes";
import { tmdbImageSizeForWidth } from "../lib/tmdb-image";

describe("poster image sizes", () => {
  it("uses absolute px slots so Next keeps every TMDB tier in srcset", () => {
    for (const sizes of [SEARCH_POSTER_SIZES, RAIL_POSTER_SIZES, ALBUM_COVER_SIZES]) {
      expect(sizes).not.toMatch(/\dvw\b/);
      expect(sizes).toMatch(/\d+px/);
    }
  });

  it("maps search card CSS widths to the smaller TMDB tiers on 1x displays", () => {
    // Mobile search card ~184px; 1x should prefer w185 over w342.
    expect(tmdbImageSizeForWidth(184)).toBe("w185");
    // 2x of 168px (common phone card) still fits w342; 184×2 crosses into w500.
    expect(tmdbImageSizeForWidth(168 * 2)).toBe("w342");
    expect(tmdbImageSizeForWidth(184 * 2)).toBe("w500");
    // Rail cards ~120px; 1x lands on w154, 2x on w342.
    expect(tmdbImageSizeForWidth(120)).toBe("w154");
    expect(tmdbImageSizeForWidth(120 * 2)).toBe("w342");
  });

  it("keeps the search above-the-fold eager window at one desktop row", () => {
    expect(SEARCH_ABOVE_FOLD_COUNT).toBe(6);
  });
});
