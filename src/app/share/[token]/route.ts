import { createClient } from "@supabase/supabase-js";
import { publicMarkdown } from "@/lib/public-markdown";
import { shareTokenPattern } from "@/lib/share-token";
export const dynamic = "force-dynamic";
const escape = (s: unknown) =>
  String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
// Static document: no client JS, analytics, remote images or workspace navigation.
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  let payload: any = null;
  if (
    shareTokenPattern.test(token) &&
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
          data?.kind === "internal_contacts" ||
          process.env.SHARING_ENABLED === "true")
      )
        payload = data;
    } catch {
      /* uniform unavailable */
    }
  }
  const markdown = publicMarkdown;
  let content = payload
    ? `<h1>${escape(payload.title || "Shared document")}</h1>${payload.start ? `<p>${escape(payload.start)} – ${escape(payload.end)}</p>` : ""}${payload.notes.map((n: any) => `<section><h2>${escape(n.title)}</h2>${markdown(n.body)}</section>`).join("")}${payload.days ? `<section><h2>Itinerary</h2>${payload.days.map((d: any, i: number) => `<h3>Day ${i + 1} · ${escape(d.title)}</h3><ul>${d.items.map((it: any) => `<li><b>${escape(it.name)}</b><p>${escape(it.description)}</p></li>`).join("")}</ul>`).join("")}</section>` : ""}${payload.contacts.length ? `<section><h2>Contacts</h2>${payload.contacts.map((c: any) => `<article><h3>${escape(c.name)}</h3><p>${escape(c.role)} · ${escape(c.organization)}</p><p>${escape(c.phone)} · ${escape(c.email)}</p></article>`).join("")}</section>` : ""}`
    : "<h1>Link unavailable</h1><p>Link ini tidak tersedia. Hubungi penyelenggara perjalanan.</p>";
  if (payload?.kind === "internal_contacts")
    content = `<h1>Contacts</h1><section><div style="overflow-x:auto"><table style="width:100%;min-width:540px;border-collapse:collapse"><thead><tr><th>Nama</th><th>Telepon / Email</th><th>Note</th><th>Sumber</th></tr></thead><tbody>${payload.contacts.map((c: any) => `<tr><td>${escape(c.name)}</td><td>${escape(c.phone)}<br>${escape(c.email)}</td><td>${escape(c.note)}</td><td>${escape(c.source)}</td></tr>`).join("")}</tbody></table></div></section><style>th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #e5e8ec;font-size:13px;overflow-wrap:anywhere}</style>`;
  return new Response(
    `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Egimu Travel · Shared document</title><style>*{box-sizing:border-box}body{font:14px/1.8 system-ui,sans-serif;background:#f6f7f9;color:#242a30;margin:0;-webkit-text-size-adjust:100%}main{max-width:880px;margin:32px auto;padding:32px;background:#fff;border:1px solid #e5e8ec;border-radius:14px}header{padding-bottom:24px;margin-bottom:28px;border-bottom:1px solid #e5e8ec}header img{object-fit:contain;border-radius:8px;width:48px;height:48px}h1{font-size:28px;line-height:1.3;letter-spacing:-.035em;font-weight:650;margin:0 0 16px;overflow-wrap:anywhere}h2{font-size:18px;line-height:1.5;font-weight:600;margin:0 0 16px}h3{font-size:15px;line-height:1.6;font-weight:600;margin:20px 0 10px}section{padding:24px 0;margin:24px 0 0;border-top:1px solid #e5e8ec}article+article{border-top:1px solid #e5e8ec;margin-top:16px;padding-top:16px}p{margin:8px 0;overflow-wrap:anywhere}a{color:#326652;text-underline-offset:3px}pre{white-space:pre-wrap;overflow-x:auto;background:#f7f8fa;padding:16px;border-radius:8px}li{margin:8px 0}table{font-variant-numeric:tabular-nums}.note-table-scroll{max-width:100%;overflow-x:auto;margin:16px 0}.note-table-scroll table{width:100%;border-collapse:collapse}.note-table-scroll th,.note-table-scroll td{border:1px solid #e5e8ec;padding:8px 12px;min-width:64px;vertical-align:top}.note-check-item{list-style:none}th{font-weight:500;background:#f7f8fa;color:#626b74}footer{margin-top:32px;padding-top:18px;border-top:1px solid #e5e8ec;font-size:12px}footer a{color:#626b74;text-decoration:none}a:focus-visible{outline:2px solid #326652;outline-offset:4px}::selection{background:#dbeae3;color:#233b30}@media(hover:hover) and (pointer:fine){footer a:hover{text-decoration:underline}}@media(max-width:650px){main{margin:12px;padding:20px;border-radius:12px}header{padding-bottom:16px;margin-bottom:20px}h1{font-size:24px}section{padding-top:20px;margin-top:20px}footer{margin-top:24px}}</style></head><body><main><header><img src="/brand/egimu-logo.jpg" alt="Egimu Travel logo" width="56" height="56"></header>${content}<footer><a href="https://github.com/nouseeme/" target="_blank" rel="noopener noreferrer">TravelOS by Noufal Rizka &copy; 2026</a></footer></main></body></html>`,
    {
      status: payload ? 200 : 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Security-Policy":
          "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
