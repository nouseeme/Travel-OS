import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { body, failure, originCheck } from "@/lib/http";
import { AppError, validateContent, money, date } from "@/lib/domain";
import { dbError } from "@/lib/supabase/server";
import { shareTokenPattern } from "@/lib/share-token";
export const dynamic = "force-dynamic";
const tokenSchema = z.string().regex(shareTokenPattern);
function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
export async function POST(request: Request) {
  try {
    originCheck(request);
    const input = z
      .object({
        token: tokenSchema,
        command: z
          .object({
            action: z.enum([
              "content",
              "update_journey",
              "create_task",
              "update_task",
              "cancel_task",
              "task_status",
              "submit_transaction",
            ]),
            id: z.uuid().optional(),
            version: z.number().int().positive().optional(),
            data: z.record(z.string(), z.unknown()).optional(),
            timezone: z.string().optional(),
          })
          .optional(),
      })
      .parse(await body(request));
    if (!input.command) {
      const { data, error } = await client().rpc("app_trip_public_read", {
        raw_token: input.token,
      });
      if (error) dbError(error);
      if (!data) throw new AppError("Link tidak tersedia.", 404);
      return NextResponse.json(data, { headers });
    }
    const c = input.command,
      d = c.data || {};
    if (c.action === "content") validateContent(d);
    if (c.action === "update_journey") {
      z.object({
        name: z.string().trim().min(1).max(200),
        trip_type: z.string().max(200),
        start: z.string(),
        end: z.string(),
        guests: z.number().int().min(1).max(100000).nullable(),
      })
        .strict()
        .parse(d);
      date(d.start, false);
      date(d.end, false);
    }
    if (["create_task", "update_task"].includes(c.action)) {
      z.object({
        title: z.string().trim().min(1).max(200),
        description: z.string().max(5000),
        due: z.string(),
      })
        .strict()
        .parse(d);
      date(d.due, false);
    }
    if (c.action === "task_status")
      z.object({ status: z.enum(["Assigned", "Doing", "Done"]) })
        .strict()
        .parse(d);
    if (c.action === "submit_transaction") {
      z.object({
        title: z.string().trim().min(1).max(200),
        date: z.string(),
        direction: z.enum(["in", "out"]),
        amount: z.string(),
        category: z.string(),
        description: z.string().max(5000),
        idempotency_key: z.uuid(),
      })
        .strict()
        .parse(d);
      money(d.amount);
      date(d.date);
    }
    const { data, error } = await client().rpc("app_trip_public_command", {
      raw_token: input.token,
      command: c,
    });
    if (error) dbError(error);
    return NextResponse.json({ id: data }, { headers });
  } catch (e) {
    return failure(e);
  }
}
