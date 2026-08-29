import { NextResponse } from "next/server";
import { searchMediaServer } from "@/lib/functions/media-repo";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const parseBoundedInteger = (value: string | null, fallback: number, min: number, max: number) => {
      if (value === null) return fallback;
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
    };

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
      limit: parseBoundedInteger(searchParams.get("limit"), 30, 1, 100),
      offset: parseBoundedInteger(searchParams.get("offset"), 0, 0, 100_000),
    };

    const results = await searchMediaServer(params);
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
