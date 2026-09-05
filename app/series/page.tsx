import SeriesCatalog from "./SeriesCatalog";
import { fetchMediaCardsServer, fetchStatsServer } from "@/lib/functions/media-repo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "电视剧",
  description: "浏览已看、在看与想看的电视剧记录。",
};

export const revalidate = 60;

export default async function SeriesPage() {
  const [stats, watchedRes, watchingRes, wantRes] = await Promise.all([
    fetchStatsServer("tv_series"),
    fetchMediaCardsServer({ type: "tv_series", status: "watched", limit: 10, offset: 0, sort: "date_desc" }),
    fetchMediaCardsServer({ type: "tv_series", status: "watching", limit: 10, offset: 0, sort: "date_desc" }),
    fetchMediaCardsServer({ type: "tv_series", status: "want_to_watch", limit: 10, offset: 0, sort: "date_desc" }),
  ]);

  return (
    <SeriesCatalog
      watched={watchedRes}
      want={wantRes}
      watching={watchingRes}
      stats={{ total: stats.total, watched: stats.watched, watching: stats.watching, want: stats.want, upcoming: stats.upcoming }}
    />
  );
}
