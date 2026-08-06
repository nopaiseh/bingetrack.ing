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
      .rpc("get_tv_seasons_by_series", { p_series_id: currentId })
      .order("season_number", { ascending: true });
  }

  const { data, error } = response as {
    data: SupabaseMediaItem[] | null;
    error: unknown;
  };

  if (error || !data || data.length === 0) return null;

  return data.map((item) => mapSupabaseToMedia(item, mode));
}
