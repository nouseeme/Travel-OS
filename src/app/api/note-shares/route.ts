import { NextResponse } from "next/server";
import { z } from "zod";
import { body, failure, originCheck } from "@/lib/http";
import { dbError, verifiedClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["status", "create", "revoke"]),
  journeyId: z.uuid(),
  noteId: z.uuid(),
});

export async function POST(request: Request) {
  try {
    originCheck(request);
    const { action, journeyId, noteId } = schema.parse(await body(request));
    const client = await verifiedClient();
    const args = {
      action_name: action,
      parent_id: journeyId,
      target_note_id: noteId,
    };
    let { data, error } = await client.rpc("app_note_share_manage", args);
    // A generated key can collide with an active link. Retry with a fresh key.
    if (action === "create" && error?.code === "23505") {
      ({ data, error } = await client.rpc("app_note_share_manage", args));
    }
    if (error) dbError(error);

    const url = data
      ? new URL(
          `/${data.moduleSlug}/note/${data.noteSlug}?key=${data.key}`,
          process.env.APP_URL || request.url,
        ).href
      : null;
    return NextResponse.json(
      { url },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
