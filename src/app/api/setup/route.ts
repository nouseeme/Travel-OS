import { NextResponse } from "next/server";
import { configured } from "@/lib/supabase/server";
export async function GET() {
  return NextResponse.json(
    {
      configured: configured(),
      emailRecovery: process.env.EMAIL_DELIVERY_ENABLED === "true",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
