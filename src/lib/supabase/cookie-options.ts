// Auth runs through server routes only; no browser Supabase client reads tokens.
export function authCookieOptions(appUrl = process.env.APP_URL) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: !!appUrl && new URL(appUrl).protocol === "https:",
    path: "/",
  };
}
