import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { validateContent } from "../src/lib/domain";
import type { Journey } from "../src/lib/model";
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
const trip = await command({
  action: "create_journey",
  data: {
    kind: "trip",
    name: "Trip contact fixture",
    client: "Fixture",
    pic: actor,
    people: [actor],
    start: "2026-11-01",
    end: "2026-11-02",
    guests: 4,
    trip_type: "Leisure",
    client_type: "Individual",
  },
});
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
// Reproduce the previous hosted dataset, whose UUID bytes came from arbitrary MD5.
const invalidId = "91af7cd7-99c6-ac8a-2fea-cffc88bae7d6";
await db.query(
  "insert into public.contacts(id,workspace_id,name,email,note) values($1,$2,'Legacy dummy UUID fixture','legacy-uuid@example.test','Keep every detail')",
  [invalidId, w],
);
for (const id of [lead, trip])
  await db.query(
    "insert into public.journey_contacts(workspace_id,journey_id,contact_id,position) values($1,$2,$3,3)",
    [w, id, invalidId],
  );
assert.throws(
  () => validateContent({ contacts: [{ ...contact, id: invalidId }] }),
  /Invalid UUID/,
);
const repair = files.find((f) => f.includes("repair_demo_contact_ids"))!;
await db.exec(await readFile("supabase/migrations/" + repair, "utf8"));
const repaired = (
  await db.query<{ id: string; note: string }>(
    "select id,note from public.contacts where email='legacy-uuid@example.test'",
  )
).rows[0];
assert.notEqual(repaired.id, invalidId);
assert.equal(repaired.note, "Keep every detail");
assert.equal(
  (
    await db.query(
      "select * from public.journey_contacts where contact_id=$1",
      [repaired.id],
    )
  ).rows.length,
  2,
);
assert.equal(
  (await db.query("select id from public.contacts")).rows.length,
  25,
);
await db.exec(await readFile("supabase/migrations/" + repair, "utf8"));
assert.equal(
  (await db.query("select id from public.contacts where id=$1", [repaired.id]))
    .rows.length,
  1,
);
console.log(
  "PASS legacy contact ID repair retains fields and both parent links, and is idempotent",
);
const member = randomUUID();
await db.query(
  "insert into auth.users(id,email) values($1,'contact-member@example.test')",
  [member],
);
await db.query(
  "insert into public.memberships(id,workspace_id,name,email,role,status,privileges) values($1,$2,'Contact member','contact-member@example.test','member','active',$3)",
  [
    member,
    w,
    JSON.stringify({
      sales: "edit",
      trips: "edit",
      finance: "none",
      docs: "none",
    }),
  ],
);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [member]);
await db.exec("set role authenticated");
for (const [view, id] of [
  ["sales", lead],
  ["trips", trip],
] as const) {
  const journey = (
    await db.query<{ s: { journeys: Journey[] } }>(
      "select public.app_snapshot($1,'{}',$2) s",
      [view, id],
    )
  ).rows[0].s.journeys[0];
  const added = {
    id: randomUUID(),
    name: `Brand new ${view} contact`,
    phone: "",
    email: "",
    role: "",
    organization: "",
    note: "",
  };
  const data = { contacts: [...journey.contacts, added] };
  // Exercise the HTTP validator as well as SQL: the browser submits existing rows too.
  validateContent(data);
  await command({ action: "content", id, version: journey.version, data });
  assert.equal(
    (await db.query("select id from public.contacts where id=$1", [added.id]))
      .rows.length,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select * from public.journey_contacts where journey_id=$1",
        [id],
      )
    ).rows.length,
    journey.contacts.length + 1,
  );
}
console.log(
  "PASS new CRM/Trip contact submissions pass the real API validator with seeded existing contacts and persist their links",
);
await db.close();
