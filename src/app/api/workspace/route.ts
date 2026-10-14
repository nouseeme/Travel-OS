import { NextResponse } from "next/server";
import { verifiedClient, adminClient, dbError } from "@/lib/supabase/server";
import { body, failure, originCheck } from "@/lib/http";
import { z } from "zod";
import type { Snapshot } from "@/lib/model";
import { validateContent, money } from "@/lib/domain";
import { parseFilters } from "@/lib/filters";
import { validTimezone } from "@/lib/time";
export const dynamic = "force-dynamic";
const commandSchema = z.object({
  timezone: z
    .string()
    .max(100)
    .refine((value) => {
      try {
        validTimezone(value);
        return true;
      } catch {
        return false;
      }
    }, "Timezone tidak valid.")
    .default("UTC"),
  action: z.enum([
    "create_journey",
    "update_journey",
    "content",
    "stage",
    "archive",
    "restore",
    "convert",
    "create_task",
    "task_status",
    "update_task",
    "cancel_task",
    "create_transaction",
    "edit_transaction",
    "void_transaction",
    "invite",
    "resend_invite",
    "revoke_invite",
    "update_person",
    "update_invitation",
    "deactivate",
    "save_stage",
    "retire_stage",
    "save_category",
    "save_template",
    "apply_template",
    "trip_view",
  ]),
  id: z.uuid().optional(),
  version: z.number().int().positive().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const view = z
      .enum([
        "home",
        "sales",
        "trips",
        "finance",
        "people",
        "configuration",
        "audit",
      ])
      .parse(url.searchParams.get("view") || "home");
    const record_id = url.searchParams.get("id");
    if (record_id) z.uuid().parse(record_id);
    const filters = parseFilters(
      Object.fromEntries(
        [...url.searchParams].filter(([k]) => !["view", "id"].includes(k)),
      ),
    );
    const client = await verifiedClient();
    const { data, error } = await client.rpc("app_snapshot", {
      view_name: view,
      filters,
      record_id: record_id || null,
    });
    if (error) dbError(error);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    originCheck(request);
    const command = commandSchema.parse(await body(request));
    if (command.action === "content") validateContent(command.data || {});
    if (["create_transaction", "edit_transaction"].includes(command.action))
      money(command.data?.amount);
    if (
      command.data &&
      "quote" in command.data &&
      command.data.quote !== "" &&
      command.data.quote !== null &&
      command.data.quote !== undefined
    )
      money(command.data.quote, false);
    const client = await verifiedClient();
    const { data, error } =
      command.action === "update_invitation"
        ? await client.rpc("update_invitation", {
            invitation_id: command.id,
            requested_privileges: command.data?.privileges,
            expected_version: command.version,
          })
        : await client.rpc("app_command", { command });
    if (error) dbError(error);
    if (command.action === "invite" || command.action === "resend_invite") {
      const snapshot = await client.rpc("app_snapshot", {
        view_name: "people",
        filters: {},
      });
      if (snapshot.error) dbError(snapshot.error);
      const invitation = (snapshot.data as Snapshot).invitations.find(
        (i) => i.id === data,
      );
      if (!invitation) throw new Error("Invitation not found");
      if (
        !process.env.SUPABASE_SECRET_KEY ||
        process.env.INVITATION_DELIVERY !== "email"
      ) {
        const delivery = await client.functions.invoke("send-invitation", {
          body: {
            invitation_id: invitation.id,
            generation_id: invitation.generation,
            delivery:
              process.env.INVITATION_DELIVERY === "email" ? "email" : "manual",
          },
        });
        if (delivery.error)
          return NextResponse.json({
            id: data,
            sent: false,
            message:
              "Invitation tersimpan. Link belum tersedia; periksa daftar invitation lalu Generate ulang.",
          });
        return NextResponse.json(delivery.data);
      }
      let providerId: string | null = null;
      let sent = false;
      try {
        const admin = adminClient();
        const redirect = `${process.env.APP_URL || new URL(request.url).origin}/auth/callback?flow=invitation&generation=${invitation.generation}`;
        const existing =
          invitation.provider_user ||
          (snapshot.data as Snapshot).people.find(
            (p) => p.email === invitation.email && p.status === "deactivated",
          )?.id;
        if (existing) {
          const reset = await admin.auth.resetPasswordForEmail(
            invitation.email,
            { redirectTo: redirect },
          );
          if (reset.error) throw reset.error;
          providerId = existing;
        } else {
          const res = await admin.auth.admin.inviteUserByEmail(
            invitation.email,
            { redirectTo: redirect },
          );
          if (res.error) throw res.error;
          providerId = res.data.user.id;
        }
        const saved = await admin.rpc("invitation_delivery", {
          invitation_id: invitation.id,
          generation_id: invitation.generation,
          provider_id: providerId,
          delivery_status: "sent",
        });
        if (saved.error) throw saved.error;
        sent = true;
      } catch {
        try {
          await adminClient().rpc("invitation_delivery", {
            invitation_id: invitation.id,
            generation_id: invitation.generation,
            provider_id: providerId,
            delivery_status: "failed",
          });
        } catch {
          /* Remains pending, retryable; never reports sent. */
        }
      }
      return NextResponse.json({
        id: data,
        message: sent
          ? "Invitation diterima provider email."
          : "Invitation tersimpan; pengiriman gagal. Periksa konfigurasi email, lalu Resend.",
        sent,
      });
    }
    return NextResponse.json({ id: data, message: "Perubahan tersimpan." });
  } catch (e) {
    return failure(e);
  }
}
