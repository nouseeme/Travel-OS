import { createClient } from "@supabase/supabase-js";
import {
  escapeSharedHtml as escape,
  publicDocument,
} from "@/lib/public-document";
import { publicMarkdown } from "@/lib/public-markdown";
import { shareTokenPattern } from "@/lib/share-token";
export const dynamic = "force-dynamic";
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
  return publicDocument(content, payload ? 200 : 404);
}
