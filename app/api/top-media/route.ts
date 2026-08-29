import { NextResponse } from "next/server";
import { fetchTopMediaServer } from "@/lib/functions/media-repo";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const year = searchParams.get("year");
    const requestedLimit = Number(searchParams.get("limit") ?? 10);
    const limit = Number.isSafeInteger(requestedLimit)
      ? Math.min(20, Math.max(1, requestedLimit))
      : 10;

    if (type !== "movie" && type !== "tv_series") {
      return NextResponse.json({ error: "Invalid media type" }, { status: 400 });
    }

    const items = await fetchTopMediaServer(type, year || null, limit);
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
