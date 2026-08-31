import { NextResponse } from "next/server";
import { searchMediaServer } from "@/lib/functions/media-repo";
import { ApiValidationError, parseMediaSearchParams } from "@/lib/api/media-params";

export async function GET(request: Request) {
  try {
    const params = parseMediaSearchParams(new URL(request.url).searchParams);
    const results = await searchMediaServer(params);
    return NextResponse.json(results, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
    });
  } catch (err) {
    if (err instanceof ApiValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Media API request failed:", err);
    return NextResponse.json({ error: "Unable to load media" }, { status: 503 });
  }
}
