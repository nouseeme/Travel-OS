import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,encrypted_password text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
);
const files = (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();
const migration = files.find((f) => f.includes("shared_contacts_relational"))!;
for (const file of files.filter((f) => f < migration))
  await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
await db.exec(await readFile("supabase/seed.sql", "utf8"));
const w = "10000000-0000-4000-8000-000000000001",
  actor = "00000000-0000-4000-8000-000000000001";
await db.exec(
  `insert into auth.users(id,email) values('${actor}','fixture@example.test');insert into public.memberships(id,workspace_id,name,email,role,status,privileges) values('${actor}','${w}','Fixture','fixture@example.test','admin','active','{"sales":"edit","trips":"edit","finance":"edit","docs":"edit"}');select set_config('request.jwt.claim.sub','${actor}',false);`,
);
const command = async (c: unknown) =>
  (
    await db.query<{ id: string }>("select public.app_command($1::jsonb) id", [
      JSON.stringify(c),
    ])
  ).rows[0].id;
const lead = await command({
  action: "create_journey",
  data: {
    kind: "lead",
    name: "Preserve this itinerary",
    client: "Fixture client",
    pic: actor,
    people: [actor],
    guests: 4,
    trip_type: "Leisure",
    client_type: "Individual",
  },
});
const contact = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "Old fixture contact",
  role: "Client",
  organization: "Old fixture",
  email: "old-fixture@example.test",
  phone: "",
  note: "Remove me",
};
await command({
  action: "content",
  id: lead,
  version: 1,
  data: { contacts: [contact] },
});
await command({
  action: "save_internal_contacts",
  version: 1,
  data: { contacts: [contact] },
});
const before = (
  await db.query<{ data: Record<string, unknown> }>(
    "select data from public.journeys where id=$1",
    [lead],
  )
).rows[0].data;
await db.query(
  "insert into private.contact_share_links(workspace_id,token_hash,payload,expires_at,created_by) values($1,'fixture',jsonb_build_object('contacts',$2::jsonb),now()+interval '1 day',$3)",
  [w, JSON.stringify([contact]), actor],
);
await db.exec(await readFile("supabase/migrations/" + migration, "utf8"));
assert.equal(
  (await db.query<{ n: number }>("select count(*)::int n from public.contacts"))
    .rows[0].n,
  1,
);
assert.equal(
  (
    await db.query<{ n: number }>(
      "select count(*)::int n from public.journey_contacts",
    )
  ).rows[0].n,
  1,
);
assert.deepEqual(
  (
    await db.query<{ contacts: any[] }>(
      "select contacts from private.internal_contacts",
    )
  ).rows[0].contacts[0].name,
  contact.name,
);
const after = (
  await db.query<{ data: Record<string, unknown> }>(
    "select data from public.journeys where id=$1",
    [lead],
  )
).rows[0].data;
assert.deepEqual(after, { ...before, contacts: [] });
await db.exec(await readFile("supabase/reset-contacts.sql", "utf8"));
assert.equal(
  (await db.query<{ n: number }>("select count(*)::int n from public.contacts"))
    .rows[0].n,
  24,
);
assert.equal(
  (
    await db.query<{ n: number }>(
      "select count(*)::int n from public.journey_contacts where journey_id=$1",
      [lead],
    )
  ).rows[0].n,
  3,
);
assert.equal(
  (
    await db.query<{ n: number }>(
      "select count(*)::int n from public.contacts where email='old-fixture@example.test'",
    )
  ).rows[0].n,
  0,
);
assert.deepEqual(
  (
    await db.query<{ payload: { contacts: unknown[] }; revoked_at: unknown }>(
      "select payload,revoked_at from private.contact_share_links",
    )
  ).rows[0].payload.contacts,
  [],
);
assert.deepEqual(
  (
    await db.query<{ data: Record<string, unknown> }>(
      "select data from public.journeys where id=$1",
      [lead],
    )
  ).rows[0].data,
  after,
);
console.log(
  "PASS populated contact migration normalizes shared contacts; scoped reset removes legacy data and preserves journey details",
);
await db.close();
