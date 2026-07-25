import { supabaseServer } from "@/utils/supabase";
import { Media } from "../types/Media";

export async function getMedia(id: string): Promise<Media | null> {
  const queryId = id;
  const { data, error } = await supabaseServer
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
    .eq("id", queryId)
    .single();

  if (error || !data) return null;

  const credits = data.media_credits ?? [];
  const casts = credits
    .filter((c: any) => c.role === 'actor')
    .sort((a: any, b: any) => (a.credit_order ?? 0) - (b.credit_order ?? 0))
    .map((c: any) => c.people?.name)
    .filter(Boolean);

  const directors = credits
    .filter((c: any) => c.role === 'director')
    .map((c: any) => c.people?.name)
    .filter(Boolean);

  return  {
    id: data.id,
    title: data.title,
    date: data.release_date ?? "",
    rating: data.tracking?.[0]?.rating ?? null,
    genres: (data.media_genres ?? []).flatMap((g: any) => 
      Array.isArray(g.genres) ? g.genres.map((x: any) => x.name) : [g.genres?.name]
    ).filter(Boolean),
    languages: (data.media_languages ?? []).flatMap((l: any) => 
      Array.isArray(l.languages) ? l.languages.map((x: any) => x.name) : [l.languages?.name]
    ).filter(Boolean),
    regions: (data.media_regions ?? []).flatMap((r: any) => 
      Array.isArray(r.regions) ? r.regions.map((x: any) => x.name) : [r.regions?.name]
    ).filter(Boolean),
    series: Array.isArray(data.media_series) 
      ? data.media_series[0]?.name ?? null 
      : (data.media_series as any)?.name ?? null,
    status: data.tracking?.[0]?.status ?? "",
    summary: data.summary ?? "",
    cover_url: data.cover_url ?? "",
    casts,
    directors
  };
}