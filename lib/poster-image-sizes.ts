/**
 * next/image `sizes` for posters.
 *
 * next.config.ts puts TMDB widths into imageSizes/deviceSizes so srcset `w`
 * descriptors match CDN files. That makes deviceSizes[0] === 780. Next’s
 * getWidths() then treats any `vw` in `sizes` as a fraction of 780 and drops
 * smaller TMDB tiers from srcset (e.g. 42vw → only w342+). Prefer absolute
 * px (or calc) that match the rendered card width so every TMDB tier stays
 * available and the browser can pick w92/w154/w185 on small layouts.
 */

/** Search grid: 2 / 3 / 4 / 6 columns with container padding and gutters. */
export const SEARCH_POSTER_SIZES =
  "(max-width: 639px) 184px, (max-width: 1023px) 230px, (max-width: 1279px) 228px, 186px";

/**
 * First row on xl (6 cols) and about three rows on a phone (2 cols).
 * Index 0 gets preload; indices below this count load eagerly.
 */
export const SEARCH_ABOVE_FOLD_COUNT = 6;

/** Home continue-watching / reading rails: ~3 cards on phone, sm:w-36. */
export const RAIL_POSTER_SIZES = "(max-width: 639px) 120px, 144px";

/** Catalog MediaRow album tiles: w-40 / sm:w-48 square covers. */
export const ALBUM_ROW_COVER_SIZES = "(max-width: 639px) 160px, 192px";
