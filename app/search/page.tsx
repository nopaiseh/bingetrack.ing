import SearchClient from "./SearchClient";
import { fetchSearchOptionsServer } from "@/lib/functions/search-options";

export const revalidate = 3600;

export default async function SearchPage() {
  const initialOptions = await fetchSearchOptionsServer();
  return <SearchClient initialOptions={initialOptions} />;
}
