import { createClient } from "@supabase/supabase-js";
import { publicMarkdown } from "@/lib/public-markdown";
export const dynamic = "force-dynamic";
const escape = (s: unknown) =>
  String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
// Static document: no client JS, analytics, remote images or internal navigation.
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  let payload: any = null;
  if (
    /^[a-f0-9]{64}$/.test(token) &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    try {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data, error } = await client.rpc("app_share_read", {
        raw_token: token,
      });
      if (
        !error &&
        (data?.kind === "internal_doc" ||
          process.env.SHARING_ENABLED === "true")
      )
        payload = data;
    } catch {
      /* uniform unavailable */
    }
  }
  const markdown = publicMarkdown;
  const content = payload
    ? `<h1>${escape(payload.title || "Shared document")}</h1>${payload.start ? `<p>${escape(payload.start)} – ${escape(payload.end)}</p>` : ""}${payload.notes.map((n: any) => `<section><h2>${escape(n.title)}</h2>${markdown(n.body)}</section>`).join("")}${payload.days ? `<section><h2>Itinerary</h2>${payload.days.map((d: any, i: number) => `<h3>Day ${i + 1} · ${escape(d.title)}</h3><ul>${d.items.map((it: any) => `<li><b>${escape(it.name)}</b><p>${escape(it.description)}</p></li>`).join("")}</ul>`).join("")}</section>` : ""}${payload.contacts.length ? `<section><h2>Contacts</h2>${payload.contacts.map((c: any) => `<article><h3>${escape(c.name)}</h3><p>${escape(c.role)} · ${escape(c.organization)}</p><p>${escape(c.phone)} · ${escape(c.email)}</p></article>`).join("")}</section>` : ""}`
    : "<h1>Link unavailable</h1><p>Link ini tidak tersedia. Hubungi penyelenggara perjalanan.</p>";
  return new Response(
    `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Travel OS · Shared document</title><style>body{font:16px/1.65 system-ui;background:#f6f7f2;color:#21362d;margin:0}main{max-width:760px;margin:40px auto;padding:24px}section{background:#fff;padding:24px;border-radius:12px;margin:20px 0}a{color:#235c46}pre{white-space:pre-wrap}p{overflow-wrap:anywhere}</style></head><body><main>${content}</main></body></html>`,
    {
      status: payload ? 200 : 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
