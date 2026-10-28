import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";

// A populated upgrade and a failed upgrade use separate transactions in an
// isolated PostgreSQL database. This script never reads hosted credentials.
const db = new PGlite();
await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth;
 create table auth.users(id uuid primary key,email text,encrypted_password text);
 create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
 $$;
 grant usage on schema auth to authenticated;
 grant execute on function auth.uid() to authenticated;
`);
const files = (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();
const migration = files.find((f) => f.endsWith("_kanban_manual_order.sql"))!;
for (const file of files.filter((f) => f < migration))
  await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
await db.exec(await readFile("supabase/seed.sql", "utf8"));
const sql = await readFile(`supabase/migrations/${migration}`, "utf8");
const workspace = "10000000-0000-4000-8000-000000000001";
const actor = "00000000-0000-4000-8000-000000000001";
await db.query(
  "insert into auth.users(id,email) values($1,'upgrade@example.test')",
  [actor],
);
await db.query(
  `insert into public.memberships(id,workspace_id,name,email,role,status,privileges)
 values($1,$2,'Upgrade fixture','upgrade@example.test','admin','active',
 '{"sales":"edit","trips":"edit","finance":"edit","docs":"edit"}')`,
  [actor, workspace],
);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor]);
const command = async (c: unknown) =>
  (
    await db.query<{ id: string }>("select public.app_command($1::jsonb) id", [
      JSON.stringify(c),
    ])
  ).rows[0].id;
const trips: string[] = [];
for (const name of ["Earlier card", "Later card"])
  trips.push(
    await command({
      action: "create_journey",
      data: {
        kind: "trip",
        name,
        client: "Upgrade fixture",
        pic: actor,
        people: [actor],
        start: "2100-01-01",
        end: "2100-01-02",
        guests: 2,
        trip_type: "Leisure",
      },
    }),
  );
await command({
  action: "create_task",
  data: {
    title: "Keep this task",
    description: "",
    context: "internal",
    assignee: actor,
    due: "2100-01-01",
  },
});
const category = (
  await db.query<{ id: string }>(
    "select id from public.finance_categories where direction='in' and active order by id limit 1",
  )
).rows[0].id;
const today = (
  await db.query<{ day: string }>("select current_date::text as day")
).rows[0].day;
await command({
  action: "create_transaction",
  data: {
    title: "Keep this posted receipt",
    idempotency_key: "00000000-0000-4000-8000-000000000010",
    description: "Upgrade fixture",
    date: today,
    direction: "in",
    amount: "100.25",
    category,
    trip: trips[0],
  },
});
await db.query(
  "insert into public.user_preferences(user_id,trip_view) values($1,'calendar')",
  [actor],
);
await db.query(
  `insert into private.invitations(workspace_id,email,name,privileges,status,invited_by)
 values($1,'revoked@example.test','Keep revoked login invitation','{"sales":"none","trips":"view","finance":"none","docs":"none"}','revoked',$2)`,
  [workspace, actor],
);

const businessTables = [
  "auth.users",
  "public.memberships",
  "public.journeys",
  "public.tasks",
  "public.transactions",
  "private.invitations",
  "private.audit_events",
];
async function businessState() {
  const state: Record<string, unknown> = {};
  for (const table of businessTables)
    state[table] = (
      await db.query<{ data: unknown }>(
        `select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') data from ${table} x`,
      )
    ).rows[0].data;
  return state;
}
const baseline = await businessState();
const definition = async (signature: string) =>
  (
    await db.query<{ definition: string }>(
      "select pg_get_functiondef($1::regprocedure) definition",
      [signature],
    )
  ).rows[0].definition;
const originalCommand = await definition("private.command(jsonb)");
const driftCases = [
  {
    signature: "private.snapshot_core(text,jsonb,uuid)",
    anchor: "order by\n    case when view_name='trips'",
    replacement: "ORDER BY\n    case when view_name='trips'",
    error: /Journey sorting anchor changed/,
  },
  {
    signature: "private.snapshot_core(text,jsonb,uuid)",
    anchor: "order by case when v->>'status'='Done'",
    replacement: "ORDER BY case when v->>'status'='Done'",
    error: /Core task sorting anchor changed/,
  },
  {
    signature: "private.snapshot_p1(text,jsonb,uuid)",
    anchor: "partition by t.data->>'status' order by",
    replacement: "partition by t.data->>'status' ORDER BY",
    error: /Filtered task sorting anchor changed/,
  },
];
for (const drift of driftCases) {
  const original = await definition(drift.signature);
  assert.ok(original.includes(drift.anchor));
  await db.exec(original.replace(drift.anchor, drift.replacement));
  await db.exec("begin");
  await assert.rejects(db.exec(sql), drift.error);
  await db.exec("rollback");
  const columns = await db.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name='user_preferences' and column_name='board_orders'",
  );
  assert.equal(
    columns.rows.length,
    0,
    "failed upgrade leaves no added preference column",
  );
  assert.equal(
    (
      await db.query<{ fn: string | null }>(
        "select to_regprocedure('private.command_before_board_order(jsonb)')::text fn",
      )
    ).rows[0].fn,
    null,
  );
  assert.equal(await definition("private.command(jsonb)"), originalCommand);
  assert.deepEqual(await businessState(), baseline);
  await db.exec(original);
}
console.log(
  "PASS each Kanban query-anchor drift aborts the upgrade and rolls back DDL, wrappers and data",
);

await db.exec("begin");
await db.exec(sql);
await db.exec("commit");
assert.deepEqual(
  await businessState(),
  baseline,
  "successful migration preserves existing business, login and audit rows exactly",
);
assert.deepEqual(
  (
    await db.query(
      "select trip_view,board_orders from public.user_preferences where user_id=$1",
      [actor],
    )
  ).rows[0],
  { trip_view: "calendar", board_orders: {} },
);
await db.exec("set role anon");
await assert.rejects(
  db.query("select board_orders from public.user_preferences"),
);
await assert.rejects(
  db.query("select public.app_command($1::jsonb)", [
    JSON.stringify({ action: "board_move" }),
  ]),
);
await db.exec("reset role; set role authenticated");
const snapshot = (
  await db.query<{ s: any }>("select public.app_snapshot('trips','{}',null) s")
).rows[0].s;
const lane = snapshot.journeys.find((j: any) => j.id === trips[0]).stage;
await command({
  action: "board_move",
  id: trips[1],
  version: 1,
  data: { board: "trips", column: lane, order: [trips[1], trips[0]] },
});
const updated = (
  await db.query<{ s: any }>("select public.app_snapshot('trips','{}',null) s")
).rows[0].s;
assert.equal(updated.tripView, "calendar");
assert.deepEqual(
  updated.journeys.map((j: any) => j.id),
  [trips[1], trips[0]],
);
console.log(
  "PASS populated Kanban upgrade preserves business rows, revoked login invitations and calendar preference; migrated commands and default manual ordering work",
);
await db.close();
