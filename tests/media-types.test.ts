import { describe, expect, it } from "vitest";
import {
  ADMIN_BULK_DB_TYPES,
  CATALOG_DB_TYPES,
  MEDIA_TYPE_DEFINITIONS,
  PUBLIC_DETAIL_PATH_PATTERN,
  PUBLIC_DETAIL_ROUTE_SEGMENTS,
  PUBLIC_MEDIA_TYPES,
  PUBLIC_SEASON_PATH_PATTERN,
  SEARCH_DB_TYPES,
  adminBulkOpsLabelList,
  adminMediaListTypes,
  dbTypeToPublicRoute,
  isAdminBulkMediaType,
  isCatalogDbMediaType,
  isManagedMediaType,
  isPublicMediaType,
  isSearchDbMediaType,
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
    expect(CATALOG_DB_TYPES).toEqual(["movie", "tv_show", "album", "book"]);
    expect(PUBLIC_MEDIA_TYPES).toEqual(["movies", "shows", "albums", "books"]);
    expect(adminMediaListTypes).toEqual(["movie", "tv_show", "album", "book"]);

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
    expect(publicPathForDbType("book", "abc")).toBe("/books/abc");
    expect(publicPathForDbType("music", "abc")).toBe("/music/abc");
    expect(publicPathForDbType("tv_season", "abc")).toBeNull();
  });

  it("keeps music songs off the public catalog while allowing search type=music and /music/[id]", () => {
    expect(MEDIA_TYPE_DEFINITIONS.movie.enabled).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.tv_show.enabled).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.tv_season.enabled).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.tv_episode.enabled).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.music.enabled).toBe(false);
    expect(MEDIA_TYPE_DEFINITIONS.album.enabled).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.book.enabled).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.book.adminManaged).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.book.adminBulkOps).toBe(true);

    expect(isCatalogDbMediaType("movie")).toBe(true);
    expect(isCatalogDbMediaType("tv_show")).toBe(true);
    expect(isCatalogDbMediaType("album")).toBe(true);
    expect(isCatalogDbMediaType("book")).toBe(true);
    expect(isCatalogDbMediaType("music")).toBe(false);
    expect(SEARCH_DB_TYPES).toEqual(["movie", "tv_show", "album", "book", "music"]);
    expect(isSearchDbMediaType("music")).toBe(true);
    expect(isSearchDbMediaType("book")).toBe(true);
    expect(isSearchDbMediaType("tv_season")).toBe(false);
    expect(isPublicMediaType("movies")).toBe(true);
    expect(isPublicMediaType("albums")).toBe(true);
    expect(isPublicMediaType("books")).toBe(true);
    expect(isPublicMediaType("music")).toBe(false);
  });

  it("PUBLIC_DETAIL_PATH_PATTERN covers catalog, music, and people detail IDs", () => {
    expect(PUBLIC_DETAIL_ROUTE_SEGMENTS).toEqual(["movies", "shows", "albums", "books", "music", "people"]);
    expect("/music/abc".match(PUBLIC_DETAIL_PATH_PATTERN)?.[1]).toBe("abc");
    expect("/people/abc".match(PUBLIC_DETAIL_PATH_PATTERN)?.[1]).toBe("abc");
    expect("/albums/abc".match(PUBLIC_DETAIL_PATH_PATTERN)?.[1]).toBe("abc");
    expect("/music".match(PUBLIC_DETAIL_PATH_PATTERN)).toBeNull();
  });

  it("keeps zh labels and tracking verbs per type family", () => {
    expect(mediaTypes).toEqual({
      movie: "电影",
      tv_show: "电视节目",
      tv_season: "季",
      tv_episode: "单集",
      music: "歌曲",
      album: "音乐",
      book: "图书",
    });
    expect(Object.keys(mediaTypes).every(isManagedMediaType)).toBe(true);
    expect(isManagedMediaType("album")).toBe(true);
    expect(isManagedMediaType("music")).toBe(true);
    expect(isManagedMediaType("book")).toBe(true);

    expect(publicMediaTypeLabel("movies")).toBe("电影");
    expect(publicMediaTypeLabel("shows")).toBe("电视节目");

    expect(MEDIA_TYPE_DEFINITIONS.movie.trackingLabels).toEqual({ done: "看过", want: "想看" });
    expect(MEDIA_TYPE_DEFINITIONS.tv_show.trackingLabels).toEqual({ done: "看过", want: "想看" });
    expect(MEDIA_TYPE_DEFINITIONS.music.trackingLabels).toEqual({ done: "听过", want: "想听" });
    expect(MEDIA_TYPE_DEFINITIONS.album.trackingLabels).toEqual({ done: "听过", want: "想听" });
    expect(MEDIA_TYPE_DEFINITIONS.book.trackingLabels).toEqual({
      done: "读过",
      want: "想读",
      inProgress: "在读",
    });
  });

  it("uses poster aspect for film/TV/book and square for music", () => {
    expect(MEDIA_TYPE_DEFINITIONS.movie.coverAspect).toBe("2/3");
    expect(MEDIA_TYPE_DEFINITIONS.tv_show.coverAspect).toBe("2/3");
    expect(MEDIA_TYPE_DEFINITIONS.book.coverAspect).toBe("2/3");
    expect(MEDIA_TYPE_DEFINITIONS.music.coverAspect).toBe("1/1");
    expect(MEDIA_TYPE_DEFINITIONS.album.coverAspect).toBe("1/1");
  });

  it("normalizes dual forms and TV child types; rejects unknown values", () => {
    expect(normalizeToPublicMediaType("movie")).toBe("movies");
    expect(normalizeToPublicMediaType("movies")).toBe("movies");
    expect(normalizeToPublicMediaType("tv_show")).toBe("shows");
    expect(normalizeToPublicMediaType("shows")).toBe("shows");
    expect(normalizeToPublicMediaType("album")).toBe("albums");
    expect(normalizeToPublicMediaType("albums")).toBe("albums");
    expect(normalizeToPublicMediaType("book")).toBe("books");
    expect(normalizeToPublicMediaType("books")).toBe("books");
    expect(normalizeToPublicMediaType("tv_season")).toBe("shows");
    expect(normalizeToPublicMediaType("tv_episode")).toBe("shows");
    expect(normalizeToPublicMediaType(null)).toBeNull();
    expect(normalizeToPublicMediaType(undefined)).toBeNull();
    expect(normalizeToPublicMediaType("")).toBeNull();
    expect(normalizeToPublicMediaType("music")).toBeNull();
    expect(normalizeToPublicMediaType("tv_series")).toBeNull();
    expect(normalizeToPublicMediaType("unknown")).toBeNull();
  });

  it("exposes schema.org types and default SEO descriptions from config", () => {
    expect(mediaSchemaType("movies")).toBe("Movie");
    expect(mediaSchemaType("shows")).toBe("TVSeries");
    expect(mediaSchemaType("music")).toBe("MusicRecording");
    expect(mediaSchemaType("album")).toBe("MusicAlbum");
    expect(mediaSchemaType("book")).toBe("Book");
    expect(mediaDefaultDescription("测试", "shows")).toBe("查看《测试》的季度、单集与观看记录。");
    expect(mediaDefaultDescription("歌", "music")).toBe("查看《歌》的收听记录与详细信息。");
    expect(mediaDefaultDescription("书", "book")).toBe("查看《书》的阅读记录与详细信息。");
  });

  it("includes album and book in admin bulk ops while keeping tracks out", () => {
    expect(ADMIN_BULK_DB_TYPES).toEqual(["movie", "tv_show", "album", "book"]);
    expect(isAdminBulkMediaType("movie")).toBe(true);
    expect(isAdminBulkMediaType("music")).toBe(false);
    expect(isAdminBulkMediaType("album")).toBe(true);
    expect(isAdminBulkMediaType("book")).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.music.adminBulkOps).toBe(false);
    expect(MEDIA_TYPE_DEFINITIONS.album.adminBulkOps).toBe(true);
    expect(MEDIA_TYPE_DEFINITIONS.book.adminBulkOps).toBe(true);
    expect(adminBulkOpsLabelList()).toBe("电影和电视节目和音乐和图书");
  });

  it("safely converts public routes and derives the season path from config", () => {
    expect(tryPublicRouteToDbType("movies")).toBe("movie");
    expect(tryPublicRouteToDbType("albums")).toBe("album");
    expect(tryPublicRouteToDbType("books")).toBe("book");
    expect(tryPublicRouteToDbType("music")).toBeNull();
    expect(tryPublicRouteToDbType(undefined)).toBeNull();
    expect("/shows/abc/seasons/def".match(PUBLIC_SEASON_PATH_PATTERN)?.[1]).toBe("def");
  });
});
