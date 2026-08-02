import { getSupabaseServer } from "@/utils/supabase";
import { Media } from "@/lib/types/Media";
import { mapSupabaseToMedia, MediaType, SupabaseMediaItem } from "@/lib/functions/mediaMapper";

export async function getMedia(
  id: string,
  type: MediaType,
): Promise<Media | null> {
  let response;

  if (type === "movies") {
    response = await getSupabaseServer()
      .from("media_items")
      .select(`
        id, title, summary, cover_url, release_date, type, runtime,
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
    response = await getSupabaseServer()
      .rpc("get_tv_series_details", { p_id: id })
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
