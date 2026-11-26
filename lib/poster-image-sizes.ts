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

/**
 * Home continue rails and catalog MediaRow cards share w-40 / sm:w-48
 * (~160px / 192px). Same absolute px slots keep every TMDB tier in srcset.
 */
export const RAIL_POSTER_SIZES = "(max-width: 639px) 160px, 192px";

/** Catalog MediaRow album tiles: same card width as RAIL_POSTER_SIZES. */
export const ALBUM_ROW_COVER_SIZES = RAIL_POSTER_SIZES;
