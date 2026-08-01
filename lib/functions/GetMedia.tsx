import { supabaseServer } from "@/utils/supabase";
import { Media } from "@/lib/types/Media";
import { mapSupabaseToMedia, MediaType, SupabaseMediaItem } from "@/lib/functions/mediaMapper";

export async function getMedia(
  id: string,
  type: MediaType,
): Promise<Media | null> {
  let response;

  if (type === "movies") {
    response = await supabaseServer
      .from("media_items")
      .select(`
        id, title, summary, cover_url, release_date, type,
        tracking!inner ( status, rating ),
        media_genres ( genres ( name ) ),
        media_languages ( languages ( name ) ),
        media_regions ( regions ( name ) ),
        media_credits ( people ( name ), role, credit_order ),
        media_series ( name )
      `)
      .eq("id", id)
      .single();
  } else {
    response = await supabaseServer
      .rpc("get_tv_series_by_id", { p_id: id })
      .order("release_years", { ascending: false })
      .eq("id", id)
      .single();
  }

  const { data, error } = response as {
    data: SupabaseMediaItem | null;
    error: unknown;
  };

  if (error || !data) {
    return null;
  }

  return mapSupabaseToMedia(data, type);
}
