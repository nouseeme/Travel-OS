import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
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
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(values) {
            for (const v of values) request.cookies.set(v.name, v.value);
            response = NextResponse.next({ request });
            for (const v of values)
              response.cookies.set(v.name, v.value, v.options);
          },
        },
      },
    );
    await client.auth.getClaims();
  }
  response.headers.set("Cache-Control", "private, no-store");
  if (
    ["/share/", "/shared-trip/", "/api/shared-trip"].some((p) =>
      request.nextUrl.pathname.startsWith(p),
    )
  )
    response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
