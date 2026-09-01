import { NextResponse } from "next/server";
import { fetchTopMediaServer } from "@/lib/functions/media-repo";
import { ApiValidationError, parseTopMediaParams } from "@/lib/api/media-params";
import { checkRateLimit } from "@/lib/api/rate-limit";

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, "top-media", 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
    );
  }

  try {
    const { type, year, limit } = parseTopMediaParams(new URL(request.url).searchParams);
    const items = await fetchTopMediaServer(type, year, limit);
    return NextResponse.json(items, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Top media API request failed:", error);
    return NextResponse.json({ error: "Unable to load top media" }, { status: 503 });
  }
}
