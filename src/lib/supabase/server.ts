import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { AppError } from "../domain";
import { authCookieOptions } from "./cookie-options";
export function configured() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
export async function supabase() {
  if (!configured())
    throw new AppError(
      "Supabase belum terhubung. Konfigurasi .env.local sesuai README sebelum login.",
      503,
    );
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: authCookieOptions(),
      cookies: {
        getAll: () => jar.getAll(),
        setAll(values) {
          for (const v of values) jar.set(v.name, v.value, v.options);
        },
      },
    },
  );
}
export function adminClient() {
  if (!process.env.SUPABASE_SECRET_KEY)
    throw new AppError("Server invitation key belum dikonfigurasi.", 503);
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export { dbError } from "../database-error";
export async function verifiedClient() {
  const client = await supabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new AppError("Silakan login.", 401);
  return client;
}
