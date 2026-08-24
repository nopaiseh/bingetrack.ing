import SeriesCatalog from "./SeriesCatalog";
import { fetchMediaListServer, fetchStatsServer } from "@/lib/functions/media-repo";

export const revalidate = 60;

export default async function SeriesPage() {
  const [stats, watchedRes] = await Promise.all([
    fetchStatsServer("tv_series"),
    fetchMediaListServer({ type: "tv_series", limit: 10, offset: 0, sort: "date_desc" }),
  ]);

  return (
    <SeriesCatalog
      watched={watchedRes.rows}
      want={[]}
      watching={[]}
      stats={{ totalSeries: stats.total, totalSeasons: 0, totalEpisodes: 0, totalUpcomingEpisodes: stats.upcoming }}
    />
  );
}
