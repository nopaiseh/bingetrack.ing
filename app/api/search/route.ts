import { NextResponse } from "next/server";
import { searchMediaServer } from "@/lib/functions/media-repo";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const params = {
      q: searchParams.get("q") || undefined,
      type: searchParams.get("type") || undefined,
      genre: searchParams.get("genre") || undefined,
      region: searchParams.get("region") || undefined,
      language: searchParams.get("language") || undefined,
      // 接收新的年份区间参数
      startYear: searchParams.get("startYear") || undefined,
      endYear: searchParams.get("endYear") || undefined,
      status: searchParams.get("status") || undefined,
      // 接收排序参数
      sort: searchParams.get("sort") || undefined,
    };

    const results = await searchMediaServer(params);
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}