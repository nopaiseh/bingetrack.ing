import { NextResponse } from "next/server";
import { fetchMediaListServer } from "@/lib/functions/media-repo";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || undefined;
    const type = url.searchParams.get("type") || undefined;
    const genre = url.searchParams.get("genre") || undefined;
    const region = url.searchParams.get("region") || undefined;
    const language = url.searchParams.get("language") || undefined;
    const year = url.searchParams.get("year") || undefined;
    const sort = url.searchParams.get("sort") || undefined;
    const limit = Number(url.searchParams.get("limit") || 50);
    const offset = Number(url.searchParams.get("offset") || 0);

    const { rows, total } = await fetchMediaListServer({ type, genre, region, language, year, q, sort, limit, offset });
    return NextResponse.json({ rows, total, limit, offset });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
