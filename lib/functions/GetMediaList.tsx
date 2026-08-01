import { supabaseServer } from "@/utils/supabase";
import { Media } from "@/lib/types/Media";
import { mapSupabaseToMedia, SupabaseMediaItem } from "@/lib/functions/mediaMapper";

export async function getMediaList({
  seriesName,
  currentId,
}: {
  seriesName: string;
  currentId: string;
}): Promise<Media[] | null> {
  const { data, error } = (await supabaseServer
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
    .order("release_date", { ascending: true })) as {
    data: SupabaseMediaItem[] | null;
    error: unknown;
  };

  if (error || !data || data.length === 0) return null;

  return data.map((item) => mapSupabaseToMedia(item, "movies"));
}
