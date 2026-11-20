import { describe, expect, it } from "vitest";
import {
  ADMIN_BULK_DB_TYPES,
  CATALOG_DB_TYPES,
  MEDIA_TYPE_DEFINITIONS,
  PUBLIC_MEDIA_TYPES,
  PUBLIC_SEASON_PATH_PATTERN,
  adminBulkOpsLabelList,
  adminMediaListTypes,
  dbTypeToPublicRoute,
  isAdminBulkMediaType,
  isCatalogDbMediaType,
  isManagedMediaType,
  isPublicMediaType,
  mediaDefaultDescription,
  mediaSchemaType,
  mediaTypes,
  normalizeToPublicMediaType,
  publicMediaTypeLabel,
  publicPathForDbType,
  publicRouteToDbType,
  tryPublicRouteToDbType,
} from "@/lib/media-types";

describe("media type config", () => {
  it("round-trips catalog db types and public routes", () => {
    expect(CATALOG_DB_TYPES).toEqual(["movie", "tv_show", "album"]);
    expect(PUBLIC_MEDIA_TYPES).toEqual(["movies", "shows", "albums"]);
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
    expect(publicPathForDbType("album", "abc")).toBe("/albums/abc");
    expect(publicPathForDbType("tv_season", "abc")).toBeNull();
  });

  it("enables album catalog while keeping music singles and books disabled", () => {
    expect(MEDIA_TYPE_DEFINITIONS.movie.enabled).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.tv_show.enabled).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.tv_season.enabled).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.tv_episode.enabled).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.music.enabled).toBe(false);
    expect(MEDIA_TYPE_DEFINITIONS.album.enabled).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.book.enabled).toBe(false);

    expect(isCatalogDbMediaType("movie")).toBe(true);
    expect(isCatalogDbMediaType("tv_show")).toBe(true);
    expect(isCatalogDbMediaType("album")).toBe(true);
    expect(isCatalogDbMediaType("music")).toBe(false);
    expect(isCatalogDbMediaType("book")).toBe(false);
    expect(isPublicMediaType("movies")).toBe(true);
    expect(isPublicMediaType("albums")).toBe(true);
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

  it("exposes schema.org types and default SEO descriptions from config", () => {
    expect(mediaSchemaType("movies")).toBe("Movie");
    expect(mediaSchemaType("shows")).toBe("TVSeries");
    expect(mediaSchemaType("music")).toBe("MusicRecording");
    expect(mediaSchemaType("album")).toBe("MusicAlbum");
    expect(mediaDefaultDescription("测试", "shows")).toBe("查看《测试》的季度、单集与观看记录。");
    expect(mediaDefaultDescription("歌", "music")).toBe("查看《歌》的收听记录与详细信息。");
  });

  it("keeps music out of admin bulk ops and derives the list-type error labels", () => {
    expect(ADMIN_BULK_DB_TYPES).toEqual(["movie", "tv_show"]);
    expect(isAdminBulkMediaType("movie")).toBe(true);
    expect(isAdminBulkMediaType("music")).toBe(false);
    expect(isAdminBulkMediaType("album")).toBe(false);
    expect(MEDIA_TYPE_DEFINITIONS.music.adminBulkOps).toBe(false);
    expect(adminBulkOpsLabelList()).toBe("电影和电视节目");
  });

  it("safely converts public routes and derives the season path from config", () => {
    expect(tryPublicRouteToDbType("movies")).toBe("movie");
    expect(tryPublicRouteToDbType("albums")).toBe("album");
    expect(tryPublicRouteToDbType("music")).toBeNull();
    expect(tryPublicRouteToDbType(undefined)).toBeNull();
    expect("/shows/abc/seasons/def".match(PUBLIC_SEASON_PATH_PATTERN)?.[1]).toBe("def");
  });
});
