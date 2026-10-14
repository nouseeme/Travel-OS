import { NextResponse } from "next/server";
import { verifiedClient, dbError } from "@/lib/supabase/server";
import { csv } from "@/lib/domain";
import type { Snapshot, Transaction } from "@/lib/model";
import { failure, originCheck, body } from "@/lib/http";
import { parseFilters } from "@/lib/filters";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    originCheck(request);
    const filters = parseFilters(await body(request));
    const client = await verifiedClient();
    const { data, error } = await client.rpc("app_export", { filters });
    if (error) dbError(error);
    const snapshot = await client.rpc("app_snapshot", {
      view_name: "finance",
      filters,
    });
    if (snapshot.error) dbError(snapshot.error);
    const s = snapshot.data as Snapshot;
    return new NextResponse(csv(data as Transaction[], s.journeys, s.people), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Travel-OS-IDR-${s.today}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
