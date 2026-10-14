import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { body, failure, originCheck } from "@/lib/http";
import { verifiedClient, dbError } from "@/lib/supabase/server";
import { AppError } from "@/lib/domain";
export const dynamic = "force-dynamic";
const schema = z.object({
  action: z.enum([
    "preview",
    "list",
    "create",
    "publish",
    "regenerate",
    "revoke",
  ]),
  trip: z.uuid().optional(),
  permissions: z
    .record(z.string(), z.enum(["none", "view", "edit"]))
    .optional(),
  doc: z.uuid().optional(),
  link: z.uuid().optional(),
  version: z.number().int().positive().optional(),
  days: z.number().int().min(1).max(30).default(7),
  selection: z
    .object({
      title: z.string().max(200).default(""),
      notes: z.array(z.uuid()).max(30).default([]),
      contacts: z.array(z.uuid()).max(100).default([]),
      dates: z.boolean().default(false),
      itinerary: z.boolean().default(false),
    })
    .default({
      title: "",
      notes: [],
      contacts: [],
      dates: false,
      itinerary: false,
    }),
});
export async function POST(request: Request) {
  try {
    originCheck(request);
    const d = schema.parse(await body(request));
    if ((!d.trip && !d.doc) || (d.trip && d.doc))
      throw new AppError("Pilih Trip atau dokumen.");
    const client = await verifiedClient();
    const token = ["create", "regenerate"].includes(d.action)
      ? randomBytes(32).toString("hex")
      : null;
    const { data, error } = await client.rpc(
      d.doc ? "app_doc_share_manage" : "app_trip_share_manage",
      {
        action_name: d.action,
        ...(d.doc ? { doc_id: d.doc } : { trip_id: d.trip }),
        link_id: d.link || null,
        expected_version: d.version || null,
        ...(!d.doc ? { permissions: d.permissions || {} } : {}),
        raw_token: token,
        expiry_days: d.days,
      },
    );
    if (error) dbError(error);
    return NextResponse.json(
      {
        ...data,
        ...(d.action === "list"
          ? {
              enabled: data.enabled,
            }
          : {}),
        ...(token
          ? {
              url: `${process.env.APP_URL || new URL(request.url).origin}/${d.doc ? "share" : "shared-trip"}/${token}`,
            }
          : {}),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
