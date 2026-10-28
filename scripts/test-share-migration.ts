import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key,email text,encrypted_password text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
const files = (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();
const migration = files.find((f) => f.includes("reusable_short_share_links"))!;
for (const f of files.filter((f) => f < migration))
  await db.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
await db.exec(await readFile("supabase/seed.sql", "utf8"));
const w = "10000000-0000-4000-8000-000000000001";
const actor = "00000000-0000-4000-8000-000000000001";
await db.query(
  "insert into auth.users(id,email) values($1,'fixture@example.test')",
  [actor],
);
await db.query(
  `insert into public.memberships(id,workspace_id,name,email,role,status,privileges)
values($1,$2,'Fixture','fixture@example.test','admin','active','{"sales":"edit","trips":"edit","finance":"edit","docs":"edit"}')`,
  [actor, w],
);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor]);
const trip = (
  await db.query<{ id: string }>("select public.app_command($1::jsonb) id", [
    JSON.stringify({
      action: "create_journey",
      data: {
        kind: "trip",
        name: "Legacy trip",
        start: "2026-11-01",
        end: "2026-11-02",
        trip_type: "Leisure",
        guests: 2,
        client: "Fixture",
        pic: actor,
        people: [actor],
      },
    }),
  ])
).rows[0].id;
const doc = (
  await db.query<{ id: string }>("select public.app_command($1::jsonb) id", [
    JSON.stringify({
      action: "create_doc",
      data: {
        title: "Legacy doc",
        date: "2026-10-28",
        category: "General",
        body: "Keep document",
      },
    }),
  ])
).rows[0].id;
const active = "f".repeat(64);
const legacyTripToken = "a".repeat(64);
await db.query(
  "select public.app_trip_share_manage('create',$1,null,null,$2::jsonb,$3,7)",
  [
    trip,
    JSON.stringify({ overview: "view", contacts: "edit" }),
    legacyTripToken,
  ],
);
await db.query(
  `insert into private.contact_share_links(workspace_id,token_hash,payload,expires_at,created_by)
values($1,encode(sha256(convert_to($2,'UTF8')),'hex'),'{"kind":"internal_contacts","contacts":[]}',now()+interval '1 day',$3)`,
  [w, active, actor],
);
for (const table of [
  "share_links",
  "trip_access_links",
  "doc_share_links",
  "contact_share_links",
]) {
  const parent =
    table === "doc_share_links"
      ? ",doc_id"
      : table === "contact_share_links"
        ? ""
        : ",trip_id";
  const extra =
    table === "trip_access_links"
      ? ",permissions"
      : table === "doc_share_links" || table === "contact_share_links"
        ? ",payload"
        : "";
  const id = (
    await db.query<{ id: string }>(
      `insert into private.${table}(workspace_id,token_hash,expires_at,revoked_at,created_by${parent}${extra}) values($1,$2,now()+interval '1 day',now(),$3${parent ? ",$4" : ""}${extra ? ",'{}'" : ""}) returning id`,
      parent
        ? [w, table, actor, table === "doc_share_links" ? doc : trip]
        : [w, table, actor],
    )
  ).rows[0].id;
  if (table === "share_links")
    await db.query(
      "insert into private.share_snapshots(share_link_id,payload) values($1,'{}')",
      [id],
    );
  if (table === "trip_access_links")
    for (const status of ["pending", "approved", "rejected"])
      await db.query(
        "insert into private.trip_submissions(link_id,workspace_id,trip_id,data,idempotency_key,status) values($1,$2,$3,'{}',gen_random_uuid(),$4)",
        [id, w, trip, status],
      );
}
const audits = (await db.query("select id from private.audit_events")).rows
  .length;
await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
for (const table of [
  "share_links",
  "trip_access_links",
  "doc_share_links",
  "contact_share_links",
])
  assert.equal(
    (
      await db.query(
        `select id from private.${table} where revoked_at is not null`,
      )
    ).rows.length,
    0,
  );
assert.equal(
  (await db.query("select * from private.share_snapshots")).rows.length,
  0,
);
assert.equal(
  (
    await db.query(
      "select * from private.trip_submissions where link_id is null",
    )
  ).rows.length,
  3,
);
assert.equal(
  (await db.query("select id from private.audit_events")).rows.length,
  audits,
);
const alias = (
  await db.query<{ share_token: string }>(
    "select share_token from private.contact_share_links",
  )
).rows[0].share_token;
const tripAlias = (
  await db.query<{ share_token: string }>(
    "select share_token from private.trip_access_links",
  )
).rows[0].share_token;
assert.match(alias, /^link-[A-Za-z0-9_-]{22}$/);
await db.exec("set role anon");
for (const token of [legacyTripToken, tripAlias]) {
  const shared = (
    await db.query<{ r: any }>("select public.app_trip_public_read($1) r", [
      token,
    ])
  ).rows[0].r;
  assert.equal(shared.journey.id, trip);
}
const current = (
  await db.query<{ r: any }>("select public.app_trip_public_read($1) r", [
    tripAlias,
  ])
).rows[0].r;
await db.query("select public.app_trip_public_command($1,$2::jsonb)", [
  tripAlias,
  JSON.stringify({
    action: "content",
    id: trip,
    version: current.journey.version,
    data: { contacts: [] },
  }),
]);
for (const token of [active, alias])
  assert.ok(
    (
      await db.query<{ r: unknown }>("select public.app_share_read($1) r", [
        token,
      ])
    ).rows[0].r,
  );
await assert.rejects(
  db.query("select share_token from private.contact_share_links"),
);
await db.exec("reset role; set role authenticated");
const list = (
  await db.query<{ r: any }>(
    "select public.app_contacts_share_manage('list') r",
  )
).rows[0].r;
assert.equal(list.links[0].share_token, alias);
await db.query("select public.app_contacts_share_manage('revoke',$1)", [
  list.links[0].id,
]);
await db.exec("reset role;set role anon");
for (const token of [active, alias])
  assert.equal(
    (
      await db.query<{ r: unknown }>("select public.app_share_read($1) r", [
        token,
      ])
    ).rows[0].r,
    null,
  );
console.log(
  "PASS share migration cleans all revoked capabilities, preserves finance/history, and keeps legacy URLs plus recoverable aliases working",
);
await db.close();
