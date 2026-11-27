import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActorCredit, MediaInput, PersonRef } from "./media-form";

/** 并行读取编辑字段和关系，任何失败都终止，避免用空表单覆盖真实关联。 */
export async function readEditableMedia(db: SupabaseClient, id: string): Promise<MediaInput | null> {
  const results = await Promise.all([
    db.from("media_items").select("*").eq("id", id).maybeSingle(),
    db.from("tracking").select("status,rating").eq("media_item_id", id).maybeSingle(),
    db.from("tv_seasons").select("series_id,season_number").eq("id", id).maybeSingle(),
    db.from("tv_episodes").select("season_id,episode_number").eq("id", id).maybeSingle(),
    db
      .from("album_tracks")
      .select("album_id,disc_number,track_number")
      .eq("song_id", id)
      .order("disc_number", { ascending: true })
      .order("track_number", { ascending: true })
      .limit(1)
      .maybeSingle(),
    db.from("music_albums").select("label").eq("media_item_id", id).maybeSingle(),
    db.from("books").select("page_count,publisher,isbn").eq("media_item_id", id).maybeSingle(),
    db.from("media_genres").select("genres(name)").eq("media_item_id", id),
    db.from("media_languages").select("languages(name)").eq("media_item_id", id),
    db.from("media_regions").select("regions(name)").eq("media_item_id", id),
    db.from("media_item_series").select("media_series(name)").eq("media_item_id", id),
    db
      .from("media_credits")
      .select("role,character_name,people(id,name,alternate_name)")
      .eq("media_item_id", id)
      .order("credit_order"),
  ]);
  if (results.some(/* 任一失败均禁止继续编辑。 */ (result) => result.error))
    throw new Error("无法完整读取媒体资料，请重试。");
  const [
    media,
    tracking,
    season,
    episode,
    track,
    albumMeta,
    bookMeta,
    genres,
    languages,
    regions,
    collections,
    credits,
  ] = results;
  if (!media.data) return null;
  /** Supabase 多对一关联在此按数据库外键返回单个对象。 */
  function names(data: unknown, key: string, role?: string): string[] {
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        /* 人物关联按角色分别展示。 */ (row): row is Record<string, unknown> =>
          Boolean(row && typeof row === "object" && (!role || (row as Record<string, unknown>).role === role)),
      )
      .map(/* 提取关联对象名称并过滤无效条目。 */ (row) => (row[key] as { name?: string } | null | undefined)?.name)
      .filter((name): name is string => typeof name === "string" && name.length > 0);
  }
  /** 人物连同 ID 和别名读取，重新保存时仍关联原人物，不会被同名人物替换。 */
  function people(
    data: unknown,
    role: "actor" | "director" | "artist" | "lyricist" | "composer" | "author",
  ): (PersonRef & { character_name?: unknown })[] {
    if (!Array.isArray(data)) return [];
    return data.flatMap(
      /* 跳过无效行和缺少人物的关联。 */ (row) => {
        if (!row || typeof row !== "object" || row.role !== role) return [];
        const person = row.people as { id?: string; name?: string; alternate_name?: string | null } | null | undefined;
        if (typeof person?.id !== "string" || typeof person.name !== "string" || person.name.length === 0) return [];
        return [
          {
            id: person.id,
            name: person.name,
            alternate_name: person.alternate_name ?? null,
            character_name: row.character_name,
          },
        ];
      },
    );
  }
  /** 演员与角色成对读取，保证编辑后重新保存不会丢失角色名。 */
  function actorCredits(data: unknown): ActorCredit[] {
    return people(data, "actor").map(({ character_name, ...person }) => ({
      ...person,
      character: typeof character_name === "string" && character_name ? character_name : null,
    }));
  }
  let status: "watched" | "watching" | "want_to_watch" | "in_progress" = "want_to_watch";
  let rating: number | null = null;
  // 专辑语言取自 v_all_media（曲目并集，由库视图计算）；地区仍读 media_regions。
  // select 字符串须为字面量，否则 supabase-js 类型解析会报 ParserError。
  let albumLanguagesFromView: string[] | null = null;
  if (media.data.type === "tv_show" || media.data.type === "album") {
    const { data: seriesStatus } = await db
      .from("v_all_media")
      .select("status,rating,languages")
      .eq("id", id)
      .maybeSingle();
    status = (seriesStatus?.status as "watched" | "watching" | "want_to_watch") ?? "want_to_watch";
    rating = seriesStatus?.rating != null ? Number(seriesStatus.rating) : null;
    if (media.data.type === "album" && Array.isArray(seriesStatus?.languages)) {
      albumLanguagesFromView = (seriesStatus.languages as unknown[]).filter(
        (name): name is string => typeof name === "string" && name.length > 0,
      );
    }
  } else if (media.data.type === "tv_season") {
    const { data: seasonSummary } = await db
      .from("v_media_season_summaries")
      .select("episode_count,watched_episode_count")
      .eq("id", id)
      .maybeSingle();
    const episodeCount = Number(seasonSummary?.episode_count ?? 0);
    const watchedCount = Number(seasonSummary?.watched_episode_count ?? 0);
    status =
      episodeCount > 0 && watchedCount === episodeCount ? "watched" : watchedCount > 0 ? "watching" : "want_to_watch";
  } else if (media.data.type === "book") {
    const bookStatus = tracking.data?.status;
    status =
      bookStatus === "watched" || bookStatus === "want_to_watch" || bookStatus === "in_progress"
        ? bookStatus
        : "want_to_watch";
    rating = tracking.data?.rating ?? null;
  } else {
    status = (tracking.data?.status as "watched" | "want_to_watch") ?? "want_to_watch";
    rating = tracking.data?.rating ?? null;
  }
  const personOnly = (role: "artist" | "lyricist" | "composer" | "author") =>
    people(credits.data, role).map(({ id, name, alternate_name }) => ({ id, name, alternate_name }));
  const parentId = season.data?.series_id ?? episode.data?.season_id ?? track.data?.album_id ?? null;
  return {
    ...media.data,
    parent_id: parentId,
    previous_parent_id: media.data.type === "music" ? parentId : null,
    number: season.data?.season_number ?? episode.data?.episode_number ?? track.data?.track_number ?? null,
    disc_number: media.data.type === "music" && track.data?.disc_number != null ? Number(track.data.disc_number) : null,
    status,
    rating,
    genres: names(genres.data, "genres"),
    languages: albumLanguagesFromView ?? names(languages.data, "languages"),
    regions: names(regions.data, "regions"),
    collections: names(collections.data, "media_series"),
    actors: actorCredits(credits.data),
    directors: people(credits.data, "director").map(({ id, name, alternate_name }) => ({ id, name, alternate_name })),
    artists: personOnly("artist"),
    lyricists: personOnly("lyricist"),
    composers: personOnly("composer"),
    authors: personOnly("author"),
    label: albumMeta.data?.label ?? null,
    page_count: bookMeta.data?.page_count != null ? Number(bookMeta.data.page_count) : null,
    publisher: bookMeta.data?.publisher ?? null,
    isbn: bookMeta.data?.isbn ?? null,
  } as MediaInput;
}
