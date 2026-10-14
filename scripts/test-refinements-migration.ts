import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,encrypted_password text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
);
const files = (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();
const migration = files.find((f) =>
  f.includes("workspace_refinements_internal_docs"),
)!;
for (const file of files.filter((f) => f < migration))
  await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
await db.exec(await readFile("supabase/seed.sql", "utf8"));
await db.exec(`
 insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000001','migration@example.test');
 insert into public.memberships(id,workspace_id,name,email,role,status,privileges) values('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Migration','migration@example.test','admin','active','{"sales":"edit","trips":"edit","finance":"edit"}');
 insert into public.transactions(id,workspace_id,data,amount_idr,transaction_date,direction,category_id,idempotency_key) values('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','{"date":"2020-01-01","direction":"in","amount":"9007199254740993","category":"in-0","trip":null,"description":"Existing historical note","status":"posted"}',9007199254740993,'2020-01-01','in','in-0','00000000-0000-4000-8000-000000000003');
`);
await db.exec(await readFile("supabase/migrations/" + migration, "utf8"));
const saved = (
  await db.query<{
    amount: string;
    data: { title: string; description: string; amount: string };
  }>("select amount_idr::text amount,data from public.transactions")
).rows[0];
assert.equal(saved.amount, "9007199254740993.00");
assert.equal(saved.data.amount, "9007199254740993");
assert.equal(saved.data.title, "Existing historical note");
assert.equal(saved.data.description, "Existing historical note");
assert.equal(
  (
    await db.query<{ privileges: { docs: string } }>(
      "select privileges from public.memberships",
    )
  ).rows[0].privileges.docs,
  "edit",
);
console.log(
  "PASS populated migration preserves exact historical IDR, notes and privileges",
);
await db.close();
