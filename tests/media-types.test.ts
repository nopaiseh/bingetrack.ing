import { describe, expect, it } from "vitest";
import {
  CATALOG_DB_TYPES,
  MEDIA_TYPE_DEFINITIONS,
  PUBLIC_MEDIA_TYPES,
  adminMediaListTypes,
  dbTypeToPublicRoute,
  isCatalogDbMediaType,
  isManagedMediaType,
  isPublicMediaType,
  mediaTypes,
  normalizeToPublicMediaType,
  publicMediaTypeLabel,
  publicPathForDbType,
  publicRouteToDbType,
} from "@/lib/media-types";

describe("media type config", () => {
  it("round-trips catalog db types and public routes", () => {
    expect(CATALOG_DB_TYPES).toEqual(["movie", "tv_show"]);
    expect(PUBLIC_MEDIA_TYPES).toEqual(["movies", "shows"]);
    expect(adminMediaListTypes).toEqual(["movie", "tv_show"]);

    for (const db of CATALOG_DB_TYPES) {
      const route = dbTypeToPublicRoute(db);
      expect(route).toBeTruthy();
      expect(publicRouteToDbType(route!)).toBe(db);
      expect(normalizeToPublicMediaType(db)).toBe(route);
      expect(normalizeToPublicMediaType(route)).toBe(route);
    }

    expect(publicPathForDbType("movie", "abc")).toBe("/movies/abc");
    expect(publicPathForDbType("tv_show", "abc")).toBe("/shows/abc");
    expect(publicPathForDbType("tv_season", "abc")).toBeNull();
  });

  it("exposes only enabled catalog types and keeps future types disabled", () => {
    expect(MEDIA_TYPE_DEFINITIONS.movie.enabled).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.tv_show.enabled).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.tv_season.enabled).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.tv_episode.enabled).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.music.enabled).toBe(false);
    expect(MEDIA_TYPE_DEFINITIONS.album.enabled).toBe(false);
    expect(MEDIA_TYPE_DEFINITIONS.book.enabled).toBe(false);

    expect(isCatalogDbMediaType("movie")).toBe(true);
    expect(isCatalogDbMediaType("tv_show")).toBe(true);
    expect(isCatalogDbMediaType("album")).toBe(false);
    expect(isCatalogDbMediaType("music")).toBe(false);
    expect(isCatalogDbMediaType("book")).toBe(false);
    expect(isPublicMediaType("movies")).toBe(true);
    expect(isPublicMediaType("albums")).toBe(false);
  });

  it("keeps zh labels and tracking verbs per type family", () => {
    expect(mediaTypes).toEqual({
      movie: "电影",
      tv_show: "电视节目",
      tv_season: "季",
      tv_episode: "单集",
    });
    expect(Object.keys(mediaTypes).every(isManagedMediaType)).toBe(true);
    expect(isManagedMediaType("album")).toBe(false);

    expect(publicMediaTypeLabel("movies")).toBe("电影");
    expect(publicMediaTypeLabel("shows")).toBe("电视节目");

    expect(MEDIA_TYPE_DEFINITIONS.movie.trackingLabels).toEqual({ done: "看过", want: "想看" });
    expect(MEDIA_TYPE_DEFINITIONS.tv_show.trackingLabels).toEqual({ done: "看过", want: "想看" });
    expect(MEDIA_TYPE_DEFINITIONS.music.trackingLabels).toEqual({ done: "听过", want: "想听" });
    expect(MEDIA_TYPE_DEFINITIONS.album.trackingLabels).toEqual({ done: "听过", want: "想听" });
    expect(MEDIA_TYPE_DEFINITIONS.book.trackingLabels).toEqual({ done: "读过", want: "想读" });
  });

  it("uses poster aspect for film/TV/book and square for music", () => {
    expect(MEDIA_TYPE_DEFINITIONS.movie.coverAspect).toBe("2/3");
    expect(MEDIA_TYPE_DEFINITIONS.tv_show.coverAspect).toBe("2/3");
    expect(MEDIA_TYPE_DEFINITIONS.book.coverAspect).toBe("2/3");
    expect(MEDIA_TYPE_DEFINITIONS.music.coverAspect).toBe("1/1");
    expect(MEDIA_TYPE_DEFINITIONS.album.coverAspect).toBe("1/1");
  });

  it("normalizes legacy and child types like the previous mapper", () => {
    expect(normalizeToPublicMediaType("movie")).toBe("movies");
    expect(normalizeToPublicMediaType("movies")).toBe("movies");
    expect(normalizeToPublicMediaType("tv_show")).toBe("shows");
    expect(normalizeToPublicMediaType("shows")).toBe("shows");
    expect(normalizeToPublicMediaType("tv_season")).toBe("shows");
    expect(normalizeToPublicMediaType("tv_episode")).toBe("shows");
    expect(normalizeToPublicMediaType(null)).toBe("shows");
  });
});
