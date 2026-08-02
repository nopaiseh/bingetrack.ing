import { getSupabaseServer } from "@/utils/supabase";
import { Media } from "@/lib/types/Media";
import { mapSupabaseToMedia, SupabaseMediaItem } from "@/lib/functions/mediaMapper";

export async function getMediaList({
  seriesName,
  currentId,
  mode
}: {
  seriesName: string;
  currentId: string;
  mode: "movies" | "series";
}): Promise<Media[] | null> {
  let response;

  if (mode === "movies") {
    response = await getSupabaseServer()
      .from("media_items")
      .select(`
        id, title, cover_url, release_date, type,
        tracking ( rating ),
        media_genres ( genres ( name ) ),
        media_languages ( languages ( name ) ),
        media_series!inner(name)
      `)
      .eq("media_series.name", seriesName)
      .neq("id", currentId)
      .order("release_date", { ascending: true });
  } else if (mode === "series") {
    response = await getSupabaseServer()
      .from("tv_seasons")
      .select(`
        season_number,
        media_items!inner (
          id,
          title,
          cover_url,
          release_date,
          type
        ),
        tv_episodes (
          episode_number,
          media_items!inner (
            id,
            title,
            release_date,
            runtime
          )
        )
      `)
      .eq("series_id", currentId)
      .order("season_number", { ascending: true });
  }

  const { data, error } = response as {
    data: any[] | null;
    error: unknown;
  };


  if (error || !data || data.length === 0) return null;

  return data.map((item) => mapSupabaseToMedia(item, "movies"));
}
