/**
 * Search grid poster deferral.
 *
 * Cards before SEARCH_ABOVE_FOLD_COUNT (see poster-image-sizes) render images
 * immediately: the first with preload + fetchPriority="high", the rest eager.
 * Remaining cards wait until near the viewport before setting the image src.
 */
export const SEARCH_POSTER_ROOT_MARGIN = "350px";
