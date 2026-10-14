import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy } from "./lib/security-headers";
import { authCookieOptions } from "./lib/supabase/cookie-options";
export async function proxy(request: NextRequest) {
  // Static shared documents supply their own stricter script-free policy.
  const document =
    !request.nextUrl.pathname.startsWith("/api/") &&
    !request.nextUrl.pathname.startsWith("/share/");
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development",
  );
  function next() {
    const headers = new Headers(request.headers);
    if (document) {
      // Next reads the request policy and attaches this nonce to framework scripts.
      headers.set("Content-Security-Policy", policy);
      headers.set("x-nonce", nonce);
    }
    return NextResponse.next({ request: { headers } });
  }
  let response = next();
  if (
    !request.nextUrl.pathname.startsWith("/share/") &&
    !request.nextUrl.pathname.startsWith("/shared-trip/") &&
    !request.nextUrl.pathname.startsWith("/api/shared-trip") &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookieOptions: authCookieOptions(),
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(values) {
            for (const v of values) request.cookies.set(v.name, v.value);
            response = next();
            for (const v of values)
              response.cookies.set(v.name, v.value, v.options);
          },
        },
      },
    );
    await client.auth.getClaims();
  }
  response.headers.set("Cache-Control", "private, no-store");
  if (document) response.headers.set("Content-Security-Policy", policy);
  if (
    ["/share/", "/shared-trip/", "/api/shared-trip"].some((p) =>
      request.nextUrl.pathname.startsWith(p),
    )
  )
    response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
