import { NextResponse } from "next/server";
import { searchMediaServer } from "@/lib/functions/media-repo";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";

    const results = await searchMediaServer(q || undefined);
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
