import assert from "node:assert/strict";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw Error("Project environment missing");
const headers = { apikey: key, "Content-Type": "application/json" };
const settings = await fetch(url + "/auth/v1/settings", { headers });
assert.equal(settings.status, 200);
const auth = await settings.json();
assert.equal(auth.disable_signup, true);
assert.equal(auth.external.anonymous_users, false);
console.log("PASS hosted public signup and anonymous sign-in disabled");
for (const table of [
  "journeys",
  "tasks",
  "transactions",
  "memberships",
  "templates",
  "sales_stages",
  "trip_stages",
  "trip_budgets",
  "internal_docs",
  "transaction_corrections",
]) {
  const r: Response = await fetch(
    url + "/rest/v1/" + table + "?select=*&limit=1",
    {
      headers,
    },
  );
  assert.ok(
    [401, 403].includes(r.status),
    table + " anonymous read must be denied",
  );
}
console.log("PASS anonymous Data API cannot read internal tables");
for (const [name, input] of [
  [
    "app_trip_share_manage",
    { action_name: "list", trip_id: "00000000-0000-4000-8000-000000000001" },
  ],
  ["app_snapshot", { view_name: "configuration" }],
  [
    "app_command",
    { command: { action: "trip_view", data: { view: "calendar" } } },
  ],
  ["app_insights", { mode_name: "comparison" }],
  [
    "app_doc_share_manage",
    { action_name: "list", doc_id: "00000000-0000-4000-8000-000000000001" },
  ],
  [
    "manual_invitation_ready",
    {
      invitation_id: "00000000-0000-4000-8000-000000000001",
      generation_id: "00000000-0000-4000-8000-000000000001",
      provider_id: "00000000-0000-4000-8000-000000000001",
    },
  ],
] as const) {
  const r: Response = await fetch(url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  assert.ok(
    [401, 403].includes(r.status),
    name + " anonymous RPC must be denied",
  );
}
console.log("PASS anonymous mutation/admin RPCs denied");
for (const [name, input] of [
  ["app_trip_public_read", { raw_token: "0".repeat(64) }],
  [
    "app_trip_public_command",
    {
      raw_token: "0".repeat(64),
      command: { action: "submit_transaction", data: {} },
    },
  ],
] as const) {
  const r: Response = await fetch(url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  assert.ok(
    [401, 403].includes(r.status),
    name + " must reject an unavailable bearer link",
  );
  assert.equal((await r.json()).code, "42501");
}
console.log(
  "PASS live Trip read/write RPCs reject invalid bearer capabilities",
);
const share = await fetch(url + "/rest/v1/rpc/app_share_read", {
  method: "POST",
  headers,
  body: JSON.stringify({ raw_token: "0".repeat(64) }),
});
assert.equal(share.status, 200);
assert.equal(await share.json(), null);
console.log("PASS unavailable share token returns no public snapshot");
const edge = await fetch(url + "/functions/v1/send-invitation", {
  method: "POST",
  headers,
  body: "{}",
});
assert.equal(edge.status, 401);
console.log("PASS invitation function requires authentication");
console.log(
  "Hosted checks passed; no Auth users or business records created by this script.",
);
