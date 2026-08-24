import { NextResponse } from "next/server";
import { searchMediaServer } from "@/lib/functions/media-repo";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const params = {
      q: searchParams.get("q") || undefined,
      type: searchParams.get("type") || undefined,
      status: searchParams.get("status") || undefined,
      genre: searchParams.get("genre") || undefined,
      region: searchParams.get("region") || undefined,
      language: searchParams.get("language") || undefined,
      startYear: searchParams.get("startYear") || undefined,
      endYear: searchParams.get("endYear") || undefined,
      sort: searchParams.get("sort") || undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
      offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : undefined,
    };

    const results = await searchMediaServer(params);
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}