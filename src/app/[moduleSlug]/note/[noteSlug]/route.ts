import { createClient } from "@supabase/supabase-js";
import { escapeSharedHtml, publicDocument } from "@/lib/public-document";
import { publicMarkdown } from "@/lib/public-markdown";

const slugPattern = /^[a-z0-9][a-z0-9-]{0,79}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ moduleSlug: string; noteSlug: string }> },
) {
  const { moduleSlug, noteSlug } = await params;
  const accessKey = new URL(request.url).searchParams.get("key");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (
    slugPattern.test(moduleSlug) &&
    slugPattern.test(noteSlug) &&
    accessKey &&
    /^[a-f0-9]{32}$/.test(accessKey) &&
    supabaseUrl &&
    publishableKey
  ) {
    const client = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    });
    const { data, error } = await client.rpc("app_note_share_read", {
      module_path: moduleSlug,
      note_path: noteSlug,
      access_key: accessKey,
    });
    if (
      !error &&
      typeof data?.title === "string" &&
      typeof data?.body === "string"
    ) {
      return publicDocument(
        `<h1>${escapeSharedHtml(data.title)}</h1><div class="note-table-scroll">${publicMarkdown(data.body)}</div>`,
        200,
        "Shared note",
      );
    }
  }

  return publicDocument(
    "<h1>Link unavailable</h1><p>Link note ini tidak tersedia.</p>",
    404,
    "Shared note",
  );
}
