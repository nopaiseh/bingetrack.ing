import SeriesCatalog from "./SeriesCatalog";
import { fetchMediaListServer, fetchStatsServer } from "@/lib/functions/media-repo";

export const revalidate = 60;

export default async function SeriesPage() {
  const [stats, watchedRes, watchingRes, wantRes] = await Promise.all([
    fetchStatsServer("tv_series"),
    fetchMediaListServer({ type: "tv_series", status: "watched", limit: 10, offset: 0, sort: "date_desc" }),
    fetchMediaListServer({ type: "tv_series", status: "watching", limit: 10, offset: 0, sort: "date_desc" }),
    fetchMediaListServer({ type: "tv_series", status: "want_to_watch", limit: 10, offset: 0, sort: "date_desc" }),
  ]);

  return (
    <SeriesCatalog
      watched={watchedRes.rows}
      want={wantRes.rows}
      watching={watchingRes.rows}
      stats={{ total: stats.total, watched: stats.watched, watching: stats.watching, want: stats.want, upcoming: stats.upcoming }}
    />
  );
}
