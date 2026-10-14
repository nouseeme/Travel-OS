import { NextResponse } from "next/server";
import { verifiedClient, dbError } from "@/lib/supabase/server";
import { failure } from "@/lib/http";
import { parseFilters } from "@/lib/filters";
import { AppError } from "@/lib/domain";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");
    if (!["sales", "calendar", "comparison"].includes(mode || ""))
      throw new AppError("View tidak valid");
    const filters = parseFilters(Object.fromEntries(url.searchParams));
    const client = await verifiedClient();
    const { data, error } = await client.rpc("app_insights", {
      mode_name: mode,
      filters,
    });
    if (error) dbError(error);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
