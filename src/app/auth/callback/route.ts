import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = process.env.APP_URL || url.origin;
  const client = await supabase();
  let valid = false;
  const code = url.searchParams.get("code");
  const hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (code) {
    const result = await client.auth.exchangeCodeForSession(code);
    valid = !result.error;
  } else if (hash && (type === "invite" || type === "recovery")) {
    const result = await client.auth.verifyOtp({ token_hash: hash, type });
    valid = !result.error;
  }
  const target = new URL(valid ? "/create-password" : "/login", base);
  if (!valid)
    target.searchParams.set(
      "error",
      "Link tidak valid/kedaluwarsa. Minta admin Resend.",
    );
  else if (url.searchParams.get("generation"))
    target.searchParams.set("generation", url.searchParams.get("generation")!);
  return NextResponse.redirect(target);
}
