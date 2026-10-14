// Deploy with verify_jwt=true. Provider credentials remain inside Supabase.
import { createClient } from "@supabase/supabase-js";
const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers });
Deno.serve(async (req: Request) => {
  if (req.method !== "POST")
    return json({ error: "Method tidak diizinkan." }, 405);
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer "))
    return json({ error: "Silakan login." }, 401);
  const scope = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const verified = await scope.auth.getUser(authorization.slice(7));
  if (verified.error || !verified.data.user)
    return json({ error: "Silakan login." }, 401);
  const snapshot = await scope.rpc("app_snapshot", {
    view_name: "people",
    filters: {},
  });
  if (snapshot.error || snapshot.data?.user?.role !== "admin")
    return json({ error: "Admin aktif diperlukan." }, 403);
  let payload: {
    invitation_id?: string;
    generation_id?: string;
    delivery?: "manual" | "email";
  };
  try {
    const raw = await req.text();
    if (raw.length > 1024)
      return json({ error: "Payload terlalu besar." }, 413);
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "Input tidak valid." }, 400);
  }
  const invitation = snapshot.data.invitations.find(
    (i: { id: string; generation: string; status: string }) =>
      i.id === payload.invitation_id &&
      i.generation === payload.generation_id &&
      i.status === "pending",
  );
  if (!invitation)
    return json(
      { error: "Invitation replaced/revoked atau tidak aktif." },
      409,
    );
  const member = await scope
    .from("memberships")
    .select("workspace_id")
    .eq("id", verified.data.user.id)
    .single();
  if (member.error) return json({ error: "Membership tidak aktif." }, 403);
  const workspace = await scope
    .from("workspaces")
    .select("app_url")
    .eq("id", member.data.workspace_id)
    .single();
  if (workspace.error || !workspace.data.app_url)
    return json({ error: "App URL belum dikonfigurasi." }, 503);
  // Privileged client is constructed only after user-scoped admin authorization.
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const redirect = `${workspace.data.app_url}/auth/callback?flow=invitation&generation=${invitation.generation}`;
  let provider: string | null =
    invitation.provider_user ||
    snapshot.data.people.find(
      (p: { email: string; status: string; id: string }) =>
        p.email === invitation.email && p.status === "deactivated",
    )?.id ||
    null;
  let sent = false;
  let activationUrl: string | null = null;
  const manual = payload.delivery !== "email";
  try {
    if (manual) {
      const type = provider ? "recovery" : "invite";
      const result = await admin.auth.admin.generateLink({
        type,
        email: invitation.email,
        options: { redirectTo: redirect },
      });
      if (result.error) throw result.error;
      provider = result.data.user.id;
      activationUrl = `${redirect}&token_hash=${encodeURIComponent(result.data.properties.hashed_token)}&type=${type}`;
    } else if (provider) {
      const r = await admin.auth.resetPasswordForEmail(invitation.email, {
        redirectTo: redirect,
      });
      if (r.error) throw r.error;
    } else {
      const r = await admin.auth.admin.inviteUserByEmail(invitation.email, {
        redirectTo: redirect,
      });
      if (r.error) throw r.error;
      provider = r.data.user.id;
    }
    const r = manual
      ? await admin.rpc("manual_invitation_ready", {
          invitation_id: invitation.id,
          generation_id: invitation.generation,
          provider_id: provider,
        })
      : await admin.rpc("invitation_delivery", {
          invitation_id: invitation.id,
          generation_id: invitation.generation,
          provider_id: provider,
          delivery_status: "sent",
        });
    if (r.error) throw r.error;
    sent = true;
  } catch {
    await admin.rpc("invitation_delivery", {
      invitation_id: invitation.id,
      generation_id: invitation.generation,
      provider_id: provider,
      delivery_status: "failed",
    });
  }
  return json({
    id: invitation.id,
    sent,
    ...(sent && activationUrl
      ? { activation_url: activationUrl, delivery_channel: "manual" }
      : {}),
    message: sent
      ? manual
        ? "Link aktivasi siap. Salin dan kirim sendiri; link hanya ditampilkan sekarang."
        : "Invitation diterima provider email."
      : "Invitation tersimpan; pembuatan link/pengiriman gagal. Coba Generate ulang.",
  });
});
