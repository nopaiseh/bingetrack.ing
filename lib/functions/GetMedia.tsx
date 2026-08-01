import { supabaseServer } from "@/utils/supabase";
import { Media } from "../types/Media";

function mapSupabaseToMedia(data: any): Media {
  const credits = data.media_credits ?? [];
  
  const casts = credits
    .filter((c: any) => c.role === "actor")
    .sort((a: any, b: any) => (a.credit_order ?? 0) - (b.credit_order ?? 0))
    .map((c: any) => c.people?.name)
    .filter(Boolean);

  const directors = credits
    .filter((c: any) => c.role === "director")
    .map((c: any) => c.people?.name)
    .filter(Boolean);

  return {
    id: data.id,
    title: data.title,
    date: data.release_years ? `${data.release_years}` : data.release_date ?? "",
    rating: data.average_rating ? data.average_rating : data.tracking?.[0]?.rating ?? null,
    genres: data.genres ? data.genres : (data.media_genres ?? [])
      .flatMap((g: any) => (Array.isArray(g.genres) ? g.genres.map((x: any) => x.name) : [g.genres?.name]))
      .filter(Boolean),
    languages: data.languages ? data.languages : (data.media_languages ?? [])
      .flatMap((l: any) => (Array.isArray(l.languages) ? l.languages.map((x: any) => x.name) : [l.languages?.name]))
      .filter(Boolean),
    regions: data.regions ? data.regions : (data.media_regions ?? [])
      .flatMap((r: any) => (Array.isArray(r.regions) ? r.regions.map((x: any) => x.name) : [r.regions?.name]))
      .filter(Boolean),
    series: Array.isArray(data.media_series)
      ? data.media_series[0]?.name ?? null
      : data.media_series?.name ?? null,
    status: data.calculated_status ? data.calculated_status : data.tracking?.[0]?.status ?? "",
    summary: data.summary ?? "",
    cover_url: data.cover_url ?? "",
    casts,
    directors,
  };
}

export async function getMedia(id: string, type: string, status?: string): Promise<Media | null> {
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
  } else if (type === "series") {
    response = await supabaseServer
      .rpc("get_tv_series_by_id", { p_id: id })
      .order("release_years", { ascending: false })
      .eq("id", id)
      .single();
  } else {
    return null; 
  }

  const { data, error } = response;

  console.log(data);

  if (error || !data) {
    return null;
  }

  return mapSupabaseToMedia(data);
}