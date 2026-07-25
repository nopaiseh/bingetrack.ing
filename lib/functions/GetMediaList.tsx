import { supabaseServer } from "@/utils/supabase";
import { Media } from "../types/Media";

export async function getMediaList({ seriesName, currentId }: { seriesName: string, currentId: string }): Promise<Media[] | null> {
  const { data, error } = await supabaseServer
    .from("media_items")
    .select(`
      id, title, cover_url, release_date,
      tracking ( rating ),
      media_genres ( genres ( name ) ),
      media_languages ( languages ( name ) ),
      media_series!inner(name)
    `)
    .eq("media_series.name", seriesName)
    .neq("id", currentId)
    .order("release_date", { ascending: true });

  if (error || !data || data.length === 0) return null;

  return data.map((d: any) => ({
    id: String(d.id),
    title: d.title,
    cover_url: d.cover_url || "",
    date: d.release_date || "",
    rating: Array.isArray(d.tracking) ? d.tracking[0]?.rating ?? null : null,
    genres: (d.media_genres ?? []).flatMap((g: any) => 
      Array.isArray(g.genres) ? g.genres.map((x: any) => x.name) : [g.genres?.name]
    ).filter(Boolean),
    languages: (d.media_languages ?? []).flatMap((l: any) => 
      Array.isArray(l.languages) ? l.languages.map((x: any) => x.name) : [l.languages?.name]
    ).filter(Boolean)
  }));
}