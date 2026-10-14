import { NextResponse } from "next/server";
import { supabase, dbError } from "@/lib/supabase/server";
import { body, failure, originCheck } from "@/lib/http";
import { AppError } from "@/lib/domain";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    originCheck(request);
    const d = z
      .object({
        action: z.enum(["login", "logout", "recover", "password"]),
        email: z.email().optional(),
        password: z.string().min(1).max(200).optional(),
        generation: z.uuid().optional(),
      })
      .parse(await body(request));
    if (d.action === "password" && (!d.password || d.password.length < 12))
      throw new AppError("Password baru minimal 12 karakter.");
    const client = await supabase();
    if (d.action === "login") {
      if (!d.email || !d.password) throw new AppError("Email/password wajib.");
      const result = await client.auth.signInWithPassword({
        email: d.email,
        password: d.password,
      });
      if (result.error)
        throw new AppError("Email atau password tidak cocok.", 401);
      const membership = await client.rpc("app_snapshot", {
        view_name: "home",
        filters: {},
      });
      if (membership.error) {
        await client.auth.signOut();
        throw new AppError(
          "Membership belum aktif atau sudah dinonaktifkan.",
          403,
        );
      }
    }
    if (d.action === "logout") {
      const result = await client.auth.signOut();
      if (result.error)
        throw new AppError("Logout belum berhasil. Coba lagi.", 503);
    }
    if (d.action === "recover") {
      if (process.env.EMAIL_DELIVERY_ENABLED !== "true")
        throw new AppError(
          "Pemulihan email belum diaktifkan. Hubungi admin workspace.",
          503,
        );
      if (!d.email) throw new AppError("Email wajib.");
      await client.auth.resetPasswordForEmail(d.email, {
        redirectTo: `${process.env.APP_URL || new URL(request.url).origin}/auth/callback?flow=recovery`,
      });
    }
    if (d.action === "password") {
      if (!d.password) throw new AppError("Password minimal 12 karakter.");
      const verified = await client.auth.getUser();
      if (!verified.data.user)
        throw new AppError("Link invalid/expired. Minta invitation baru.", 401);
      if (d.generation) {
        const checked = await client.rpc("check_invitation", {
          generation_id: d.generation,
        });
        if (checked.error) dbError(checked.error);
      } else {
        const membership = await client.rpc("app_snapshot", {
          view_name: "home",
          filters: {},
        });
        if (membership.error)
          throw new AppError(
            "Membership tidak aktif. Minta admin Resend invitation.",
            403,
          );
      }
      const updated = await client.auth.updateUser({ password: d.password });
      if (updated.error) dbError(updated.error);
      if (d.generation) {
        const activation = await client.rpc("activate_membership", {
          generation_id: d.generation,
        });
        if (activation.error) dbError(activation.error);
      }
    }
    return NextResponse.json({
      message:
        d.action === "recover"
          ? "Jika email terdaftar, link recovery akan dikirim."
          : "Berhasil.",
    });
  } catch (e) {
    return failure(e);
  }
}
