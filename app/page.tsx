import { getSupabaseServer } from "@/utils/supabase";
import HomeDashboard from "@/app/HomeDashboard";
import { Summary } from "@/lib/types/Summary";

export const revalidate = 60;

export default async function HomePage() {
  const { data: summary, error } = (await getSupabaseServer()
    .from("release_year_stats")
    .select("*")
    .order("release_year", { ascending: false })) as {
    data: Summary[] | null;
    error: unknown;
  };

  if (error) {
    console.error("Failed to fetch release year stats:", error);
  }

  return (
    <main>
      <HomeDashboard summary={summary ?? []} />
    </main>
  );
}
