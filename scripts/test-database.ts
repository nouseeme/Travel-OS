import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,encrypted_password text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
);
for (const f of (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
await db.exec(await readFile("supabase/seed.sql", "utf8"));
const admin = randomUUID(),
  sales = randomUUID(),
  trips = randomUUID();
const w = "10000000-0000-4000-8000-000000000001";
for (const [id, name, role, priv] of [
  [admin, "Admin", "admin", { sales: "edit", trips: "edit", finance: "edit" }],
  [sales, "Sales", "member", { sales: "edit", trips: "view", finance: "none" }],
  [trips, "Trips", "member", { sales: "none", trips: "edit", finance: "view" }],
] as const) {
  await db.query("insert into auth.users(id,email) values($1,$2)", [
    id,
    name + "@example.test",
  ]);
  await db.query(
    "insert into public.memberships(id,workspace_id,name,email,role,status,privileges) values($1,$2,$3,$4,$5,$6,$7)",
    [id, w, name, name + "@example.test", role, "active", JSON.stringify(priv)],
  );
}
async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function cmd(
  action: string,
  data: Record<string, unknown> = {},
  id?: string,
  version?: number,
) {
  if (
    version === undefined &&
    id &&
    ["update_person", "deactivate"].includes(action)
  ) {
    const current = await db.query<{ version: number }>(
      "select version from public.memberships where id=$1",
      [id],
    );
    version = current.rows[0]?.version;
  }
  if (
    ["create_transaction", "edit_transaction"].includes(action) &&
    data.title === undefined &&
    typeof data.description === "string"
  )
    data = { ...data, title: data.description };
  const r = await db.query<{ id: string }>(
    "select public.app_command($1::jsonb) id",
    [JSON.stringify({ action, data, id, version })],
  );
  return r.rows[0].id;
}
async function snapshot(view: string, filters = {}, id?: string) {
  const r = await db.query<{ s: any }>(
    "select public.app_snapshot($1,$2::jsonb,$3::uuid) s",
    [view, JSON.stringify(filters), id || null],
  );
  return r.rows[0].s;
}
let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log("PASS " + name);
}
await asUser(admin);
const leadData = {
  kind: "lead",
  client: "Sekolah Nusantara",
  name: "Bandung study tour",
  pic: sales,
  people: [sales],
  stage: "Drafts",
  start: "",
  end: "",
  guests: 30,
  quote: "15000000",
  trip_type: "Educational",
  client_type: "School",
};
let lead = "",
  trip = "",
  task = "";
await test("create lead and integrated task", async () => {
  lead = await cmd("create_journey", leadData);
  task = await cmd("create_task", {
    title: "Follow up",
    context: "lead",
    parent: lead,
    assignee: sales,
    due: "2026-10-14",
  });
  assert.equal((await snapshot("sales", {}, lead)).tasks[0].id, task);
});
await test("direct anonymous and member Finance denial", async () => {
  await asUser(sales);
  await assert.rejects(snapshot("finance"));
  const rows = await db.query("select * from public.transactions");
  assert.equal(rows.rows.length, 0);
  await assert.rejects(cmd("create_transaction", {}));
  await assert.rejects(db.query("update public.memberships set role='admin'"));
  await db.exec("reset role;set role anon");
  await assert.rejects(db.query("select * from public.journeys"));
  await asUser(admin);
});
await test("conversion rollback on ineligible assignee", async () => {
  await db.exec("reset role");
  await db.query(
    'update public.memberships set privileges=privileges||\'{"trips":"none"}\'::jsonb where id=$1',
    [sales],
  );
  await asUser(admin);
  await assert.rejects(
    cmd(
      "convert",
      {
        ...leadData,
        name: "Bandung Tour",
        start: "2026-10-20",
        end: "2026-10-22",
        people: [admin],
        pic: admin,
      },
      lead,
      1,
    ),
  );
  assert.equal(
    (await snapshot("sales", {}, lead)).journeys[0].lifecycle,
    "active",
  );
  assert.equal((await snapshot("trips")).count, 0);
});
await test("atomic conversion preserves task ID and idempotent source", async () => {
  trip = await cmd(
    "convert",
    {
      name: "Bandung Tour",
      start: "2026-10-20",
      end: "2026-10-22",
      people: [admin],
      pic: admin,
      assignments: { [task]: admin },
    },
    lead,
    1,
  );
  assert.equal((await snapshot("trips", {}, trip)).tasks[0].id, task);
  assert.equal(
    (await snapshot("sales", {}, lead)).journeys[0].lifecycle,
    "converted",
  );
  assert.equal(await cmd("convert", {}, lead, 1), trip);
});
await test("optimistic conflict and constrained task status", async () => {
  await cmd("task_status", { status: "Doing", title: "FORGED" }, task, 2);
  await assert.rejects(cmd("task_status", { status: "Done" }, task, 2));
  assert.equal((await snapshot("home")).tasks[0].title, "Follow up");
});
await test("view-only Trips excludes Finance response and denies write", async () => {
  await asUser(trips);
  const s = await snapshot("trips", {}, trip);
  assert.equal(s.transactions.length, 0);
  await assert.rejects(cmd("create_transaction", {}));
  await asUser(admin);
});
let deposit = "",
  expense = "",
  general = "";
await test("exact PRD cash example and idempotency", async () => {
  const key = randomUUID();
  const d = {
    date: "2026-09-15",
    direction: "in",
    amount: "10000000",
    category: "in-0",
    trip,
    description: "Deposit",
    idempotency_key: key,
  };
  deposit = await cmd("create_transaction", d);
  assert.equal(await cmd("create_transaction", d), deposit);
  await assert.rejects(cmd("create_transaction", { ...d, amount: "11000000" }));
  expense = await cmd("create_transaction", {
    date: "2026-10-01",
    direction: "out",
    amount: "6000000",
    category: "out-1",
    trip,
    description: "Hotel",
    idempotency_key: randomUUID(),
  });
  general = await cmd("create_transaction", {
    date: "2026-10-01",
    direction: "out",
    amount: "1000000",
    category: "out-6",
    trip: null,
    description: "Overhead",
    idempotency_key: randomUUID(),
  });
  assert.equal((await snapshot("trips", {}, trip)).totals.net, "4000000");
  assert.equal(
    (await snapshot("finance", { from: "2026-10-01", to: "2026-10-31" })).totals
      .net,
    "-7000000",
  );
  assert.equal((await snapshot("finance")).totals.net, "3000000");
});
await test("reject excess decimals, locale, future, direction mismatch and foreign context", async () => {
  for (const amount of [
    "1.555",
    "1,5",
    "1e3",
    "-1",
    "0",
    "9223372036854775808",
  ])
    await assert.rejects(
      cmd("create_transaction", {
        date: "2026-09-15",
        direction: "in",
        amount,
        category: "in-0",
        trip: null,
        description: "Bad",
        idempotency_key: randomUUID(),
      }),
    );
  await assert.rejects(
    cmd("create_transaction", {
      date: "2099-01-01",
      direction: "in",
      amount: "10",
      category: "in-0",
      description: "Bad",
      idempotency_key: randomUUID(),
    }),
  );
  await assert.rejects(
    cmd("create_transaction", {
      date: "2026-09-15",
      direction: "out",
      amount: "10",
      category: "in-0",
      description: "Bad",
      idempotency_key: randomUUID(),
    }),
  );
  await assert.rejects(
    cmd("create_transaction", {
      date: "2026-09-15",
      direction: "in",
      amount: "10",
      category: "in-0",
      trip: lead,
      description: "Bad",
      idempotency_key: randomUUID(),
    }),
  );
});
await test("void is final and audit atomic", async () => {
  await assert.rejects(cmd("void_transaction", { reason: "" }, general, 1));
  await cmd("void_transaction", { reason: "Duplicate" }, general, 1);
  assert.equal((await snapshot("finance")).totals.net, "4000000");
  await assert.rejects(
    cmd("edit_transaction", { reason: "Restore" }, general, 2),
  );
  await db.exec("reset role");
  const r = await db.query(
    "select metadata from private.audit_events where action='void_transaction'",
  );
  assert.equal(r.rows.length, 1);
  await asUser(admin);
});
await test("export follows Finance view privilege and cannot spoof actor", async () => {
  await asUser(trips);
  assert.ok((await db.query("select public.app_export('{}')")).rows.length);
  await asUser(admin);
  const r = await db.query<{ rows: any[] }>(
    "select public.app_export('{}') rows",
  );
  assert.equal(r.rows[0].rows.length, 3);
});
await test("invitation beyond three users succeeds; last admin remains protected", async () => {
  const fourth = await cmd("invite", {
    email: "fourth@example.test",
    name: "Fourth",
  });
  const fifth = await cmd("invite", {
    email: "fifth@example.test",
    name: "Fifth",
  });
  assert.ok(fourth && fifth);
  await cmd("revoke_invite", {}, fourth);
  await cmd("revoke_invite", {}, fifth);
  await assert.rejects(cmd("deactivate", {}, admin));
});
await test("revocation effective on existing session", async () => {
  await cmd(
    "update_person",
    { privileges: { sales: "none", trips: "none", finance: "none" } },
    trips,
  );
  await asUser(trips);
  await assert.rejects(snapshot("trips"));
  await assert.rejects(snapshot("finance"));
  await asUser(admin);
  await cmd("deactivate", {}, trips);
  await asUser(trips);
  await assert.rejects(snapshot("home"));
});
await test("Trips-only response never carries Finance or related aggregates", async () => {
  await asUser(admin);
  await cmd(
    "update_person",
    { privileges: { sales: "edit", trips: "view", finance: "none" } },
    sales,
  );
  await asUser(sales);
  const s = await snapshot("trips", {}, trip);
  assert.equal(s.transactions.length, 0);
  assert.equal(s.categories.length, 0);
  assert.equal(s.cashRows.length, 0);
  assert.equal(s.totals.net, "0");
  await assert.rejects(cmd("stage", { stage: "Completed" }, trip, 1));
  await assert.rejects(cmd("convert", {}, lead, 2));
  await assert.rejects(db.query("select * from private.audit_events"));
  await asUser(admin);
});
await test("Finance-only projection supplies minimal Trip reference", async () => {
  await cmd(
    "update_person",
    { privileges: { sales: "none", trips: "none", finance: "view" } },
    sales,
  );
  await asUser(sales);
  const s = await snapshot("finance");
  assert.equal(s.journeys[0].name, "Bandung Tour");
  assert.equal(s.journeys[0].notes, undefined);
  assert.equal(s.journeys[0].contacts, undefined);
  assert.equal(s.journeys[0].quote, undefined);
  assert.equal(
    (await db.query("select * from public.journeys")).rows.length,
    0,
  );
  await assert.rejects(
    cmd("void_transaction", { reason: "Forbidden" }, expense, 1),
  );
  await asUser(admin);
});
await test("audit failure rolls back new cash entry", async () => {
  await db.exec(
    `reset role;create function private.fail_audit() returns trigger language plpgsql as $$begin if new.action='create_transaction' then raise exception 'forced audit failure';end if;return new;end$$;create trigger forced_audit_failure before insert on private.audit_events for each row execute function private.fail_audit();`,
  );
  await asUser(admin);
  const before = (await snapshot("finance")).count;
  await assert.rejects(
    cmd("create_transaction", {
      date: "2026-09-01",
      direction: "in",
      amount: "100",
      category: "in-0",
      description: "Rollback",
      idempotency_key: randomUUID(),
    }),
  );
  assert.equal((await snapshot("finance")).count, before);
  await db.exec(
    "reset role;drop trigger forced_audit_failure on private.audit_events;drop function private.fail_audit();",
  );
  await asUser(admin);
});
await test("cross-workspace and forged context denied", async () => {
  const other = randomUUID();
  await db.exec("reset role");
  await db.query("insert into public.workspaces values($1,$2,$3)", [
    other,
    "Other",
    "Asia/Jakarta",
  ]);
  await asUser(admin);
  await assert.rejects(
    cmd("create_task", {
      context: "trip",
      parent: trip,
      assignee: randomUUID(),
      title: "Bad",
    }),
  );
  await assert.rejects(
    cmd("create_journey", {
      ...leadData,
      pic: randomUUID(),
      workspace_id: other,
    }),
  );
  const record = await cmd("create_journey", {
    ...leadData,
    pic: admin,
    workspace_id: other,
    created_by: sales,
  });
  await db.exec("reset role");
  const r = await db.query<{ workspace_id: string }>(
    "select workspace_id from public.journeys where id=$1",
    [record],
  );
  assert.equal(r.rows[0].workspace_id, w);
  await asUser(admin);
});
let invited = "",
  generation = "",
  provider = randomUUID();
await test("reserve invitation slot and persist provider failure", async () => {
  invited = await cmd("invite", {
    email: "new@example.test",
    name: "New member",
    privileges: { sales: "none", trips: "view", finance: "none" },
  });
  generation = (await snapshot("people")).invitations.find(
    (i: any) => i.id === invited,
  ).generation;
  await assert.rejects(
    cmd("invite", { email: "new@example.test", name: "Duplicate" }),
  );
  const extra = await cmd("invite", {
    email: "fourth@example.test",
    name: "Fourth",
  });
  await cmd("revoke_invite", {}, extra);
  await db.exec("reset role;set role service_role");
  await db.query("select public.invitation_delivery($1,$2,null,'failed')", [
    invited,
    generation,
  ]);
  await asUser(admin);
  assert.equal(
    (await snapshot("people")).invitations.find((i: any) => i.id === invited)
      .status,
    "failed",
  );
});
await test("revoked/superseded invitation cannot activate through an old Auth session", async () => {
  await cmd("resend_invite", {}, invited);
  const current = (await snapshot("people")).invitations.find(
    (i: any) => i.id === invited,
  ).generation;
  assert.notEqual(current, generation);
  await db.exec("reset role");
  await db.query("insert into auth.users(id,email) values($1,$2)", [
    provider,
    "new@example.test",
  ]);
  await db.exec("set role service_role");
  await assert.rejects(
    db.query("select public.invitation_delivery($1,$2,$3,'sent')", [
      invited,
      generation,
      provider,
    ]),
  );
  await db.query("select public.invitation_delivery($1,$2,$3,'sent')", [
    invited,
    current,
    provider,
  ]);
  generation = current;
  await asUser(provider);
  await assert.rejects(snapshot("home"));
  await assert.rejects(
    db.query("select public.activate_membership($1)", [randomUUID()]),
  );
  await asUser(admin);
  await cmd("revoke_invite", {}, invited);
  await asUser(provider);
  await assert.rejects(
    db.query("select public.check_invitation($1)", [generation]),
  );
  await assert.rejects(
    db.query("select public.activate_membership($1)", [generation]),
  );
  await asUser(admin);
});
await test("valid invitation activates exactly once; provider metadata cannot grant admin", async () => {
  invited = await cmd("invite", {
    email: "new@example.test",
    name: "New member",
    privileges: { sales: "none", trips: "view", finance: "none" },
    role: "admin",
  });
  generation = (await snapshot("people")).invitations.find(
    (i: any) => i.id === invited,
  ).generation;
  await db.exec("reset role;set role service_role");
  await db.query("select public.invitation_delivery($1,$2,$3,'sent')", [
    invited,
    generation,
    provider,
  ]);
  await asUser(provider);
  await db.query("select public.check_invitation($1)", [generation]);
  await assert.rejects(
    db.query("select public.activate_membership($1)", [generation]),
  );
  await db.exec("reset role");
  await db.query(
    "update auth.users set encrypted_password='test-password-hash' where id=$1",
    [provider],
  );
  await asUser(provider);
  await db.query("select public.activate_membership($1)", [generation]);
  assert.equal((await snapshot("home")).user.role, "member");
  await assert.rejects(
    db.query("select public.activate_membership($1)", [generation]),
  );
  await assert.rejects(snapshot("finance"));
  await asUser(admin);
});
await test("expired invitation denied before password activation", async () => {
  await cmd("deactivate", {}, provider);
  const inv = await cmd("invite", {
    email: "expired@example.test",
    name: "Expired",
  });
  const gen = (await snapshot("people")).invitations.find(
    (i: any) => i.id === inv,
  ).generation;
  const authId = randomUUID();
  await db.exec("reset role");
  await db.query("insert into auth.users(id,email) values($1,$2)", [
    authId,
    "expired@example.test",
  ]);
  await db.exec("set role service_role");
  await db.query("select public.invitation_delivery($1,$2,$3,'sent')", [
    inv,
    gen,
    authId,
  ]);
  await db.exec("reset role");
  await db.query(
    "update private.invitations set expires_at=now()-interval '1 day' where id=$1",
    [inv],
  );
  await asUser(authId);
  await assert.rejects(db.query("select public.check_invitation($1)", [gen]));
  await assert.rejects(
    db.query("select public.activate_membership($1)", [gen]),
  );
  await asUser(admin);
});
await test("conversion copies real draft documents without cash entries", async () => {
  const source = await cmd("create_journey", {
    ...leadData,
    pic: admin,
    people: [admin],
  });
  const notes = [
    {
      id: randomUUID(),
      title: "Selected draft",
      body: "Requirements before conversion",
    },
  ];
  const contacts = [
    {
      id: randomUUID(),
      name: "Synthetic PIC",
      role: "PIC",
      organization: "School",
      phone: "",
      email: "",
      note: "Internal context",
    },
  ];
  const days = [
    {
      id: randomUUID(),
      title: "Arrival",
      items: [
        { id: randomUUID(), name: "Welcome", description: "Meet the group" },
      ],
    },
  ];
  await cmd("content", { notes, contacts, days }, source, 1);
  const before = (await snapshot("finance")).count;
  const target = await cmd(
    "convert",
    {
      name: "Copied draft trip",
      pic: admin,
      people: [admin],
      start: "2026-10-20",
      end: "2026-10-22",
      guests: 30,
    },
    source,
    2,
  );
  const copied = (await snapshot("trips", {}, target)).journeys[0];
  assert.equal(copied.notes[0].body, notes[0].body);
  assert.notEqual(copied.notes[0].id, notes[0].id);
  assert.notEqual(copied.contacts[0].id, contacts[0].id);
  assert.notEqual(copied.days[0].items[0].id, days[0].items[0].id);
  assert.equal((await snapshot("finance")).count, before);
  await cmd(
    "content",
    { notes: [{ ...copied.notes[0], body: "Trip-only edit" }] },
    target,
    1,
  );
  assert.equal(
    (await snapshot("sales", {}, source)).journeys[0].notes[0].body,
    notes[0].body,
  );
  await assert.rejects(cmd("restore", {}, source, 3));
  await assert.rejects(
    cmd("content", { notes: [notes[0], notes[0]] }, target, 2),
  );
});
await test("1,000-row ledger is paginated while totals and CSV use all matching rows", async () => {
  await db.exec("reset role");
  await db.query(
    `insert into public.transactions(id,workspace_id,data,trip,amount_idr,transaction_date,direction,category_id,idempotency_key)
    select gen_random_uuid(),$1::uuid,jsonb_build_object('date','2026-08-01','direction',case when n%2=1 then 'in' else 'out' end,'amount',n::text,'category',case when n%2=1 then 'in-0' else 'out-0' end,'trip',null,'title','Scale fixture '||n,'description','Scale fixture '||n,'status','posted','created_by',$2::text,'void_by',null,'void_at',null,'reason','','idempotency_key',key),null,n,'2026-08-01'::date,case when n%2=1 then 'in' else 'out' end,case when n%2=1 then 'in-0' else 'out-0' end,key
    from (select n,gen_random_uuid() key from generate_series(1,1000) n) x`,
    [w, admin],
  );
  await asUser(admin);
  const filters = { from: "2026-08-01", to: "2026-08-31", status: "posted" };
  const first = await snapshot("finance", filters);
  assert.equal(first.count, 1000);
  assert.equal(first.transactions.length, 50);
  assert.deepEqual(first.totals, {
    moneyIn: "250000",
    moneyOut: "250500",
    net: "-500",
  });
  const last = await snapshot("finance", { ...filters, page: "19" });
  assert.equal(last.transactions.length, 50);
  const exported = await db.query<{ rows: unknown[] }>(
    "select public.app_export($1::jsonb) rows",
    [JSON.stringify(filters)],
  );
  assert.equal(exported.rows[0].rows.length, 1000);
});
await test("stale privilege edits cannot restore an old permission set", async () => {
  const current = (await snapshot("people")).people.find(
    (p: any) => p.id === sales,
  );
  await cmd(
    "update_person",
    { privileges: { sales: "none", trips: "view", finance: "none" } },
    sales,
    current.version,
  );
  await assert.rejects(
    cmd(
      "update_person",
      { privileges: { sales: "edit", trips: "edit", finance: "edit" } },
      sales,
      current.version,
    ),
  );
  assert.equal(
    (await snapshot("people")).people.find((p: any) => p.id === sales)
      .privileges.finance,
    "none",
  );
});
await test("historical PIC can be archived and restore requires an eligible replacement", async () => {
  await cmd(
    "update_person",
    { privileges: { sales: "view", trips: "view", finance: "none" } },
    sales,
  );
  const id = await cmd("create_journey", {
    ...leadData,
    pic: sales,
    people: [sales],
  });
  await cmd(
    "update_person",
    { privileges: { sales: "none", trips: "none", finance: "none" } },
    sales,
  );
  await cmd(
    "archive",
    { lost: true, cancel: true, reason: "Synthetic archive" },
    id,
    1,
  );
  await assert.rejects(cmd("restore", {}, id, 2));
  await cmd("restore", { pic: admin }, id, 2);
  assert.equal((await snapshot("sales", {}, id)).journeys[0].pic, admin);
  await assert.rejects(
    cmd("create_journey", {
      ...leadData,
      pic: admin,
      people: [admin],
      client: { bad: "object" },
    }),
  );
});
await asUser(admin);
await test("P1 stable stages rename, default, retire migration and stale edit", async () => {
  const id = await cmd("create_journey", {
    ...leadData,
    pic: admin,
    people: [admin],
  });
  const cfg = await snapshot("configuration");
  const prospect = cfg.salesStages.find((x: any) => x.key === "prospect");
  await cmd(
    "save_stage",
    { id: prospect.id, label: "Qualified", position: 0, is_default: true },
    undefined,
    prospect.version,
  );
  await assert.rejects(
    cmd(
      "save_stage",
      { id: prospect.id, label: "Stale", position: 3 },
      undefined,
      prospect.version,
    ),
  );
  await cmd("stage", { stage: "Prospect" }, id, 1);
  const updated = (await snapshot("configuration")).salesStages.find(
    (x: any) => x.id === "Prospect",
  );
  await cmd(
    "retire_stage",
    { id: "Prospect", replacement: "Drafts" },
    undefined,
    updated.version,
  );
  assert.equal((await snapshot("sales", {}, id)).journeys[0].stage, "Drafts");
  assert.equal(
    (await snapshot("configuration")).salesStages.find(
      (x: any) => x.id === "Drafts",
    ).is_default,
    true,
  );
  await assert.rejects(cmd("stage", { stage: "Prospect" }, id, 3));
});
await test("P1 templates copy new IDs, append/replace, reject stale and malformed content", async () => {
  const id = await cmd("create_journey", {
    ...leadData,
    pic: admin,
    people: [admin],
  });
  const tid = await cmd("save_template", {
    name: "New note",
    kind: "lead_note",
    content: "Template body",
  });
  await cmd("apply_template", { template: tid, mode: "append" }, id, 1);
  let j = (await snapshot("sales", {}, id)).journeys[0];
  assert.equal(j.notes.length, 2);
  assert.equal(j.notes[1].body, "Template body");
  await cmd(
    "save_template",
    { name: "Changed", kind: "lead_note", content: "New body", active: true },
    tid,
    1,
  );
  assert.equal(
    (await snapshot("sales", {}, id)).journeys[0].notes[1].body,
    "Template body",
  );
  await cmd("apply_template", { template: tid, mode: "replace" }, id, 2);
  j = (await snapshot("sales", {}, id)).journeys[0];
  assert.equal(j.notes.length, 1);
  assert.equal(j.notes[0].body, "New body");
  await assert.rejects(
    cmd("apply_template", { template: tid, mode: "replace" }, id, 2),
  );
  await assert.rejects(
    cmd("save_template", {
      name: "Bad",
      kind: "itinerary",
      content: [{ title: "", items: [{ name: "", description: "" }] }],
    }),
  );
  const days = await cmd("save_template", {
    name: "Journey days",
    kind: "itinerary",
    content: [
      { title: "Arrival", items: [{ name: "Bus", description: "Station" }] },
    ],
  });
  await cmd("apply_template", { template: days, mode: "replace" }, id, 3);
  j = (await snapshot("sales", {}, id)).journeys[0];
  assert.equal(j.days[0].title, "Arrival");
  assert.match(j.days[0].items[0].id, /^[0-9a-f-]{36}$/);
});
await test("P1 category history retained and inactive category prevents new entries", async () => {
  const cat = (await snapshot("configuration")).categories.find(
    (x: any) => x.id === "out-0",
  );
  await cmd(
    "save_category",
    {
      id: cat.id,
      name: "Transport revised",
      direction: cat.direction,
      active: false,
    },
    undefined,
    cat.version,
  );
  await assert.rejects(
    cmd("create_transaction", {
      date: "2026-09-01",
      direction: "out",
      amount: "1000",
      category: cat.id,
      trip: null,
      description: "Denied inactive",
      idempotency_key: randomUUID(),
    }),
  );
  await assert.rejects(
    cmd(
      "save_category",
      { id: cat.id, name: "Wrong", direction: "in", active: true },
      undefined,
      cat.version + 1,
    ),
  );
  assert.equal(
    (await snapshot("finance")).categories.find((x: any) => x.id === cat.id)
      .name,
    "Transport revised",
  );
});
await test("P1 Calendar and comparison enforce privileges, dates and saved preferences", async () => {
  await cmd("trip_view", { view: "calendar" });
  assert.equal((await snapshot("trips")).tripView, "calendar");
  const insight = async (mode: string, filters = {}) =>
    (
      await db.query<{ r: any }>("select public.app_insights($1,$2::jsonb) r", [
        mode,
        JSON.stringify(filters),
      ])
    ).rows[0].r;
  const calendar = await insight("calendar", {
    from: "2026-09-01",
    to: "2026-09-30",
  });
  assert.ok(Array.isArray(calendar.rows));
  const comp = await insight("comparison", {
    period: "quarter",
    anchor: "2026-09-01",
  });
  assert.equal(comp.from, "2026-07-01");
  assert.equal(comp.previousFrom, "2026-04-01");
  assert.equal(comp.previousTo, "2026-06-30");
  const analytics = await insight("sales");
  assert.ok(analytics.rows.length > 0);
  assert.ok((await snapshot("audit")).audit.length > 0);
  await asUser(sales);
  await assert.rejects(snapshot("configuration"));
  await assert.rejects(snapshot("audit"));
  await assert.rejects(insight("comparison"));
  await assert.rejects(cmd("save_stage", { label: "Denied", position: 0 }));
  await asUser(admin);
});
await test("P1 sharing whitelist, default gate, snapshot isolation and revocation", async () => {
  const manage = async (
    action: string,
    id: string,
    selection: any = {},
    link: string | null = null,
    version = 1,
    token: string | null = null,
  ) =>
    (
      await db.query<{ r: any }>(
        "select public.app_share_manage($1,$2,$3,$4,$5,$6,7) r",
        [
          action,
          id,
          link,
          version,
          JSON.stringify({ notes: [], contacts: [], ...selection }),
          token,
        ],
      )
    ).rows[0].r;
  const id = await cmd("create_journey", {
    kind: "trip",
    name: "Shared trip",
    client: "Client",
    pic: admin,
    people: [admin],
    start: "2026-09-10",
    end: "2026-09-12",
    guests: 2,
    quote: "5000000",
    stage: "Planned",
  });
  let j = (await snapshot("trips", {}, id)).journeys[0];
  const contact = randomUUID();
  await cmd(
    "content",
    {
      notes: [
        ...j.notes,
        { id: randomUUID(), title: "Hidden", body: "Unselected secret" },
      ],
      contacts: [
        {
          id: contact,
          name: "Public contact",
          role: "Guide",
          organization: "Vendor",
          phone: "123",
          email: "guide@example.test",
          note: "INTERNAL SECRET",
        },
      ],
    },
    id,
    1,
  );
  j = (await snapshot("trips", {}, id)).journeys[0];
  const selection = {
    title: "Public title",
    notes: [j.notes[0].id],
    contacts: [contact],
    itinerary: true,
    dates: true,
  };
  const preview = await manage("preview", id, selection, null, 2);
  assert.equal(preview.contacts[0].note, undefined);
  assert.equal(preview.contacts[0].id, undefined);
  assert.equal(preview.quote, undefined);
  assert.equal(preview.notes.length, 1);
  assert.ok(!JSON.stringify(preview).includes("INTERNAL SECRET"));
  assert.ok(!JSON.stringify(preview).includes("Unselected secret"));
  const token = "a".repeat(64);
  await assert.rejects(manage("create", id, selection, null, 2, token));
  await db.exec("reset role");
  await db.query(
    "update public.workspaces set sharing_enabled=true where id=$1",
    [w],
  );
  await asUser(admin);
  const link = await manage("create", id, selection, null, 2, token);
  assert.equal((await manage("list", id)).links[0].token_hash, undefined);
  const read = async (t: string) =>
    (await db.query<{ r: any }>("select public.app_share_read($1) r", [t]))
      .rows[0].r;
  await db.exec("set role anon");
  assert.deepEqual(await read(token), preview);
  await assert.rejects(db.query("select * from private.share_links"));
  await assert.rejects(db.query("select * from public.journeys"));
  assert.equal(await read("b".repeat(64)), null);
  await asUser(admin);
  await cmd(
    "content",
    { notes: [{ ...j.notes[0], body: "Updated internal" }] },
    id,
    2,
  );
  assert.deepEqual(await read(token), preview);
  await assert.rejects(manage("publish", id, selection, link.id, 2));
  await manage("publish", id, selection, link.id, 3);
  assert.equal((await read(token)).notes[0].body, "Updated internal");
  const next = await manage(
    "regenerate",
    id,
    selection,
    link.id,
    3,
    "c".repeat(64),
  );
  assert.equal(await read(token), null);
  await manage("revoke", id, selection, next.id, 3);
  assert.equal(await read("c".repeat(64)), null);
  await db.exec("reset role");
  await db.query(
    "update public.workspaces set sharing_enabled=false where id=$1",
    [w],
  );
  await asUser(admin);
});
await test("manual invitation readiness is service-only and generation-checked", async () => {
  const id = randomUUID(),
    generation = randomUUID();
  await db.exec("reset role");
  await db.query(
    'insert into private.invitations(id,workspace_id,email,name,privileges,status,generation,invited_by) values($1,$2,\'manual@example.test\',\'Manual\',\'{"sales":"view","trips":"none","finance":"none"}\',\'pending\',$3,$4)',
    [id, w, generation, admin],
  );
  await asUser(admin);
  const ready = async (g: string) =>
    db.query("select public.manual_invitation_ready($1,$2,$3)", [id, g, trips]);
  await assert.rejects(ready(generation));
  await db.exec("set role service_role");
  await assert.rejects(ready(randomUUID()));
  await ready(generation);
  await asUser(admin);
  const invitation = (await snapshot("people")).invitations.find(
    (i: any) => i.id === id,
  );
  assert.equal(invitation.delivery_channel, "manual");
  assert.equal(invitation.status, "sent");
  assert.equal(invitation.provider_user, trips);
  const audit = (await snapshot("audit")).audit;
  assert.ok(!JSON.stringify(audit).includes("token_hash"));
});
await asUser(admin);
await test("P1 Home date filters run before card limits and Calendar includes final day", async () => {
  for (let n = 0; n < 51; n++)
    await cmd("create_task", {
      title: "Early " + n,
      context: "internal",
      assignee: admin,
      due: "2026-11-01",
    });
  const late = await cmd("create_task", {
    title: "Later filtered task",
    context: "internal",
    assignee: admin,
    due: "2026-12-31",
  });
  const home = await snapshot("home", {
    from: "2026-12-31",
    to: "2026-12-31",
    context: "internal",
  });
  assert.equal(home.tasks.length, 1);
  assert.equal(home.tasks[0].id, late);
  assert.equal(home.taskCounts.Assigned, 1);
  const calendar = (
    await db.query<{ r: any }>("select public.app_insights('calendar',$1) r", [
      JSON.stringify({ from: "2026-09-12", to: "2026-09-12" }),
    ])
  ).rows[0].r;
  assert.ok(calendar.rows.some((r: any) => r.name === "Shared trip"));
  const comp = (
    await db.query<{ r: any }>(
      "select public.app_insights('comparison',$1) r",
      [JSON.stringify({ period: "month", anchor: "2026-09-01" })],
    )
  ).rows[0].r;
  assert.deepEqual(
    comp.previous,
    (
      await snapshot("finance", {
        from: "2026-08-01",
        to: "2026-08-31",
        status: "posted",
      })
    ).totals,
  );
  assert.deepEqual(
    comp.current,
    (
      await snapshot("finance", {
        from: "2026-09-01",
        to: "2026-09-30",
        status: "posted",
      })
    ).totals,
  );
});
await test("local timezone snapshot, instant range and future-date validation agree", async () => {
  await asUser(admin);
  for (const timezone of [
    "America/Adak",
    "Pacific/Kiritimati",
    "Europe/Istanbul",
    "UTC",
  ]) {
    const state = await snapshot("home", { timezone });
    const expected = await db.query<{ date_text: string }>(
      "select (now() at time zone $1)::date::text as date_text",
      [timezone],
    );
    assert.equal(state.today, expected.rows[0].date_text);
    assert.equal(state.timezone, timezone);
  }
  await assert.rejects(snapshot("home", { timezone: "Invalid/Timezone" }));
  const dates = await db.query<{ early: string; late: string }>(
    "select (now() at time zone 'Etc/GMT+12')::date::text early,(now() at time zone 'Pacific/Kiritimati')::date::text late",
  );
  const { early, late } = dates.rows[0];
  assert.ok(late > early);
  const data = {
    idempotency_key: randomUUID(),
    date: late,
    direction: "in",
    amount: "1",
    category: "other_in",
    description: "Timezone boundary test",
    title: "Timezone boundary test",
    trip: "",
  };
  // Use an existing seeded category; the example key is not a generated ID.
  data.category = (await snapshot("finance")).categories.find(
    (c: any) => c.direction === "in",
  ).id;
  await assert.rejects(
    db.query("select public.app_command($1::jsonb)", [
      JSON.stringify({
        action: "create_transaction",
        timezone: "Etc/GMT+12",
        data,
      }),
    ]),
    /Future transaction date|Tanggal transaksi di masa depan/,
  );
  const result = await db.query<{ id: string }>(
    "select public.app_command($1::jsonb) id",
    [
      JSON.stringify({
        action: "create_transaction",
        timezone: "Pacific/Kiritimati",
        data,
      }),
    ],
  );
  const saved = (
    await snapshot("finance", {
      from: late,
      to: late,
      timezone: "Pacific/Kiritimati",
    })
  ).transactions.find((t: any) => t.id === result.rows[0].id);
  assert.equal(saved.date, late);
  assert.match(saved.created_at, /(Z|\+00:00)$/);
  const id = await cmd("create_journey", {
    ...leadData,
    pic: admin,
    people: [admin],
  });
  await db.exec("reset role");
  await db.query(
    "update public.journeys set created_at='2026-10-14T00:30:00Z' where id=$1",
    [id],
  );
  await asUser(admin);
  const query = async (timezone: string, day: string) =>
    (
      await db.query<{ r: any }>(
        "select public.app_insights('sales',$1::jsonb) r",
        [JSON.stringify({ timezone, from: day, to: day })],
      )
    ).rows[0].r.rows;
  assert.ok(
    (await query("America/Los_Angeles", "2026-10-13")).some(
      (j: any) => j.id === id,
    ),
  );
  assert.ok(
    !(await query("America/Los_Angeles", "2026-10-14")).some(
      (j: any) => j.id === id,
    ),
  );
  assert.ok(
    (await query("Europe/Istanbul", "2026-10-14")).some(
      (j: any) => j.id === id,
    ),
  );
});
await test("Trip pipeline is fixed, terminals archive and conversion starts Planned", async () => {
  await asUser(admin);
  const stages = (await snapshot("trips")).tripStages.filter(
    (s: any) => s.active && s.semantic === "open",
  );
  assert.deepEqual(
    stages.map((s: any) => s.id),
    ["Planned", "Confirmed", "In Progress"],
  );
  await assert.rejects(cmd("save_trip_stage", { label: "Other", position: 0 }));
  await assert.rejects(
    cmd("retire_trip_stage", { id: "Planned", replacement: "Confirmed" }),
  );
  for (const terminal of ["Completed", "Cancelled"]) {
    const id = await cmd("create_journey", {
      ...leadData,
      kind: "trip",
      pic: admin,
      people: [admin],
      stage: "Planned",
      start: "2026-10-20",
      end: "2026-10-21",
    });
    await cmd("stage", { stage: terminal }, id, 1);
    assert.equal(
      (await snapshot("trips", {}, id)).journeys[0].lifecycle,
      "archived",
    );
    assert.ok(
      !(await snapshot("trips")).journeys.some((j: any) => j.id === id),
    );
    assert.ok(
      (await snapshot("trips", { lifecycle: "archive" })).journeys.some(
        (j: any) => j.id === id,
      ),
    );
  }
});
await test("P2 budgets are exact plans, exclude void cash, reject stale writes and audit selected fields", async () => {
  await asUser(admin);
  const id = await cmd("create_journey", {
    ...leadData,
    kind: "trip",
    pic: admin,
    people: [admin],
    stage: undefined,
    start: "2026-10-20",
    end: "2026-10-21",
  });
  const category = (await snapshot("finance")).categories.find(
    (x: any) => x.direction === "out" && x.active,
  ).id;
  const data = { trip: id, category, amount: "9007199254740993" };
  await cmd("save_budget", data);
  let row = (await snapshot("finance", { budget_trip: id })).budgets.find(
    (x: any) => x.category === category,
  );
  assert.equal(row.budget, data.amount);
  assert.equal(row.actual, "0");
  await assert.rejects(
    cmd("save_budget", { ...data, amount: "-1" }, undefined, row.version),
  );
  await assert.rejects(
    cmd("save_budget", { ...data, amount: "1.555" }, undefined, row.version),
  );
  await assert.rejects(
    cmd(
      "save_budget",
      { ...data, amount: "9223372036854775808" },
      undefined,
      row.version,
    ),
  );
  const beforeCount = (await snapshot("finance")).count;
  await cmd("save_budget", { ...data, amount: "100" }, undefined, row.version);
  await assert.rejects(cmd("save_budget", data, undefined, row.version));
  assert.equal((await snapshot("finance")).count, beforeCount);
  const tx = await cmd("create_transaction", {
    trip: id,
    category,
    amount: "20",
    direction: "out",
    date: (await snapshot("finance")).today,
    description: "Budget actual",
    idempotency_key: randomUUID(),
  });
  row = (await snapshot("finance", { budget_trip: id })).budgets.find(
    (x: any) => x.category === category,
  );
  assert.equal(row.actual, "20");
  assert.equal(row.budget, "100");
  const entry = (await snapshot("finance")).transactions.find(
    (x: any) => x.id === tx,
  );
  await cmd(
    "void_transaction",
    { reason: "Fixture reversal" },
    tx,
    entry.version,
  );
  row = (await snapshot("finance", { budget_trip: id })).budgets.find(
    (x: any) => x.category === category,
  );
  assert.equal(row.actual, "0");
  await cmd("save_budget", { ...data, amount: "0" }, undefined, row.version);
  row = (await snapshot("finance", { budget_trip: id })).budgets.find(
    (x: any) => x.category === category,
  );
  assert.equal(row.budget, "0");
  const event = (
    await snapshot("audit", { action: "save_budget", actor: admin })
  ).audit.find((a: any) => a.entity === id);
  assert.equal(event.metadata.after.amount, "0");
  assert.deepEqual(Object.keys(event.metadata.after).sort(), [
    "amount",
    "category",
    "direction",
  ]);
  await db.exec("reset role");
  await db.query(
    "update private.audit_events set at='2026-10-14T00:30:00Z' where id=$1",
    [event.id],
  );
  await asUser(admin);
  assert.ok(
    (
      await snapshot("audit", {
        from: "2026-10-13",
        to: "2026-10-13",
        timezone: "America/Los_Angeles",
        action: "save_budget",
      })
    ).audit.some((a: any) => a.id === event.id),
  );
  assert.ok(
    !(
      await snapshot("audit", {
        from: "2026-10-14",
        to: "2026-10-14",
        timezone: "America/Los_Angeles",
        action: "save_budget",
      })
    ).audit.some((a: any) => a.id === event.id),
  );
  await assert.rejects(cmd("save_budget", { ...data, trip: lead }));
  await assert.rejects(cmd("save_budget", { ...data, trip: randomUUID() }));
});
await test("P2 Finance projections and pipeline writes obey module privileges", async () => {
  await db.exec("reset role");
  const tripOnly = randomUUID(),
    financeOnly = randomUUID();
  for (const [id, name, privileges] of [
    [tripOnly, "P2 Trips", { sales: "none", trips: "view", finance: "none" }],
    [
      financeOnly,
      "P2 Finance",
      { sales: "none", trips: "none", finance: "view" },
    ],
  ] as const) {
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      id + "@example.test",
    ]);
    await db.query(
      "insert into public.memberships(id,workspace_id,name,email,role,status,privileges) values($1,$2,$3,$4,'member','active',$5)",
      [id, w, name, id + "@example.test", JSON.stringify(privileges)],
    );
  }
  await asUser(tripOnly);
  const tripsState = await snapshot("trips");
  assert.ok(tripsState.tripStages.length);
  assert.equal(tripsState.budgets, undefined);
  assert.ok(
    !(await snapshot("audit")).audit.some((e: any) =>
      [
        "save_budget",
        "save_category",
        "create_transaction",
        "edit_transaction",
        "void_transaction",
      ].includes(e.action),
    ),
  );
  assert.equal(
    (await db.query("select * from public.trip_budgets")).rows.length,
    0,
  );
  await assert.rejects(
    cmd("save_budget", { trip: trip, category: "out-0", amount: "1" }),
  );
  await assert.rejects(
    cmd("save_trip_stage", {
      label: "Forbidden",
      position: 5,
      semantic: "open",
    }),
  );
  assert.ok(
    (await snapshot("audit")).audit.every(
      (e: any) => !e.action.includes("transaction"),
    ),
  );
  await asUser(financeOnly);
  const financeState = await snapshot("finance");
  assert.equal(financeState.tripStages, undefined);
  assert.equal(financeState.budgets.length, 0);
  const target = financeState.journeys[0].id;
  assert.ok(
    (await snapshot("finance", { budget_trip: target })).budgets.length,
  );
  await assert.rejects(
    cmd("save_budget", { trip: target, category: "out-0", amount: "1" }),
  );
  await assert.rejects(
    db.query(
      "insert into public.trip_budgets(workspace_id,trip_id,category_id,amount_idr) values($1,$2,'out-0',1)",
      [w, target],
    ),
  );
  await asUser(admin);
});
await test("multiple admins retain explicit privileges and protect the last active administrator", async () => {
  await asUser(admin);
  const second = randomUUID();
  await db.exec("reset role");
  await db.query(
    "insert into auth.users(id,email) values($1,'second-admin@example.test')",
    [second],
  );
  await db.query(
    "insert into public.memberships(id,workspace_id,name,email,role,status,privileges) values($1,$2,'Second admin','second-admin@example.test','member','active',$3)",
    [
      second,
      w,
      JSON.stringify({
        sales: "none",
        trips: "none",
        finance: "view",
        docs: "none",
      }),
    ],
  );
  await asUser(admin);
  await cmd("update_person", { role: "admin" }, second);
  await asUser(second);
  assert.equal((await snapshot("people")).user.role, "admin");
  assert.ok((await snapshot("home", { assignee: "all" })).tasks.length);
  await assert.rejects(snapshot("sales"));
  await assert.rejects(cmd("create_transaction", {}));
  // Promoted admin can manage the first; a last-admin demotion cannot commit.
  await cmd("update_person", { role: "member" }, admin);
  await assert.rejects(cmd("update_person", { role: "member" }, second));
  await assert.rejects(cmd("deactivate", {}, second));
  await cmd("update_person", { role: "admin" }, admin);
  await asUser(admin);
  await cmd("update_person", { role: "member" }, second);
});
await test("decimal corrections remain pending until admin review; members cannot confirm or void", async () => {
  await asUser(admin);
  const editor = randomUUID();
  await db.exec("reset role");
  await db.query(
    "insert into auth.users(id,email) values($1,'finance-editor@example.test')",
    [editor],
  );
  await db.query(
    "insert into public.memberships(id,workspace_id,name,email,role,status,privileges) values($1,$2,'Finance editor','finance-editor@example.test','member','active',$3)",
    [
      editor,
      w,
      JSON.stringify({
        sales: "none",
        trips: "none",
        finance: "edit",
        docs: "none",
      }),
    ],
  );
  await asUser(editor);
  const entry = {
    title: "Vendor invoice",
    description: "",
    date: "2026-09-01",
    amount: "9007199254740993.51",
    direction: "out",
    category: "out-1",
    trip: null,
    idempotency_key: randomUUID(),
  };
  const id = await cmd("create_transaction", entry);
  await assert.rejects(
    cmd("create_transaction", {
      ...entry,
      title: "",
      idempotency_key: randomUUID(),
    }),
  );
  await assert.rejects(
    cmd("void_transaction", { reason: "Not allowed" }, id, 1),
  );
  const baseline = (await snapshot("finance")).totals.net;
  await cmd(
    "edit_transaction",
    { ...entry, amount: "9007199254740993.52", reason: "Fix invoice cents" },
    id,
    1,
  );
  let snap = await snapshot("finance");
  assert.equal(snap.totals.net, baseline);
  const correction = snap.corrections.find((c: any) => c.transaction_id === id);
  assert.equal(correction.original.amount, entry.amount);
  await assert.rejects(
    cmd("approve_correction", {}, correction.id, correction.version),
  );
  await assert.rejects(
    cmd(
      "reject_correction",
      { reason: "Not allowed" },
      correction.id,
      correction.version,
    ),
  );
  await assert.rejects(
    cmd("edit_transaction", { ...entry, reason: "Duplicate" }, id, 1),
  );
  await asUser(admin);
  await cmd("approve_correction", {}, correction.id, correction.version);
  snap = await snapshot("finance");
  const changed = snap.transactions.find((t: any) => t.id === id);
  assert.equal(changed.amount, "9007199254740993.52");
  assert.equal(changed.description, "");
  assert.equal(changed.confirmed_by, admin);
  assert.equal(
    snap.corrections.some((c: any) => c.transaction_id === id),
    false,
  );
  await assert.rejects(
    cmd("approve_correction", {}, correction.id, correction.version),
  );
  await cmd(
    "edit_transaction",
    { ...entry, amount: "1.25", reason: "Should be rejected" },
    id,
    changed.version,
  );
  const rejected = (await snapshot("finance")).corrections.find(
    (c: any) => c.transaction_id === id,
  );
  await cmd(
    "reject_correction",
    { reason: "Invoice unchanged" },
    rejected.id,
    rejected.version,
  );
  assert.equal(
    (await snapshot("finance")).transactions.find((t: any) => t.id === id)
      .amount,
    "9007199254740993.52",
  );
  await cmd(
    "edit_transaction",
    { ...entry, amount: "1.25", reason: "Pending before void" },
    id,
    changed.version,
  );
  const voidPending = (await snapshot("finance")).corrections.find(
    (c: any) => c.transaction_id === id,
  );
  await cmd(
    "void_transaction",
    { reason: "Duplicate invoice" },
    id,
    changed.version,
  );
  await assert.rejects(
    cmd("approve_correction", {}, voidPending.id, voidPending.version),
  );
});
await test("Confirmed trips advance at H-2 in workspace time while Planned waits", async () => {
  await asUser(admin);
  const boundary = await db.query<{ h2: string; h3: string }>(
    "select to_char((now() at time zone 'Asia/Jakarta')::date+2,'YYYY-MM-DD') h2,to_char((now() at time zone 'Asia/Jakarta')::date+3,'YYYY-MM-DD') h3",
  );
  const { h2, h3 } = boundary.rows[0];
  const fixture = {
    ...leadData,
    kind: "trip",
    pic: admin,
    people: [admin],
    stage: "Confirmed",
    start: h3,
    end: h3,
    quote: "1250000.25",
  };
  const id = await cmd("create_journey", fixture);
  assert.equal(
    (await snapshot("trips", {}, id)).journeys[0].stage,
    "Confirmed",
  );
  await cmd("update_journey", { start: h2 }, id, 1);
  const progress = (await snapshot("trips", { timezone: "Etc/GMT+12" }, id))
    .journeys[0];
  assert.equal(progress.stage, "In Progress");
  assert.equal(progress.version, 3);
  assert.equal((await snapshot("trips", {}, id)).journeys[0].version, 3);
  const planned = await cmd("create_journey", {
    ...fixture,
    stage: "Planned",
    start: h2,
  });
  assert.equal(
    (await snapshot("trips", {}, planned)).journeys[0].stage,
    "Planned",
  );
  await cmd("archive", { outcome: "completed" }, id, progress.version);
  assert.equal(
    (await snapshot("trips", {}, id)).journeys[0].stage,
    "Completed",
  );
  assert.equal(
    (await snapshot("trips", {}, id)).journeys[0].lifecycle,
    "archived",
  );
});
const docsReader = randomUUID();
await test("Internal Docs enforce view/edit privileges, immutable creator, templates and optimistic saves", async () => {
  await asUser(admin);
  const person = (await snapshot("people")).user;
  await cmd(
    "update_person",
    { privileges: { ...person.privileges, docs: "edit" } },
    admin,
    person.version,
  );
  const doc = {
    title: "Operations SOP",
    date: "2026-10-14",
    category: "SOP",
    body: "## Checklist\n\n- [ ] Review **invoice**\n\n| Item | Value |\n| --- | --- |\n| Budget | 100 |",
  };
  const id = await cmd("create_doc", doc);
  const saved = (await snapshot("docs", {}, id)).documents[0];
  assert.equal(saved.creator, admin);
  assert.equal(saved.body, doc.body);
  assert.equal((await snapshot("docs")).documents[0].body, undefined);
  assert.equal((await snapshot("docs", { search: "Operations" })).count, 1);
  assert.ok(
    (await snapshot("docs")).templates.some(
      (t: any) => t.kind === "internal_doc",
    ),
  );
  await cmd(
    "update_doc",
    { ...doc, title: "Updated SOP", creator: trips },
    id,
    1,
  );
  assert.equal((await snapshot("docs", {}, id)).documents[0].creator, admin);
  await assert.rejects(cmd("update_doc", doc, id, 1));
  await assert.rejects(
    cmd("update_doc", { ...doc, body: "x".repeat(50001) }, id, 2),
  );
  await db.exec("reset role");
  await db.query(
    "insert into auth.users(id,email) values($1,'docs-reader@example.test')",
    [docsReader],
  );
  await db.query(
    "insert into public.memberships(id,workspace_id,name,email,role,status,privileges) values($1,$2,'Docs reader','docs-reader@example.test','member','active',$3)",
    [
      docsReader,
      w,
      JSON.stringify({
        sales: "none",
        trips: "none",
        finance: "none",
        docs: "view",
      }),
    ],
  );
  await asUser(docsReader);
  assert.equal(
    (await snapshot("docs", {}, id)).documents[0].title,
    "Updated SOP",
  );
  await assert.rejects(cmd("update_doc", doc, id, 2));
  await assert.rejects(
    cmd("save_template", {
      name: "Denied",
      kind: "internal_doc",
      content: "Test",
    }),
  );
  await assert.rejects(
    db.query("update public.internal_docs set body='FORGED'"),
  );
  await asUser(admin);
  await cmd("save_template", {
    name: "SOP template",
    kind: "internal_doc",
    content: "## SOP",
  });
  await db.exec("reset role;set role anon");
  await assert.rejects(db.query("select * from public.internal_docs"));
  await asUser(sales);
  await assert.rejects(snapshot("docs"));
  assert.equal(
    (await db.query("select * from public.internal_docs")).rows.length,
    0,
  );
  await asUser(admin);
});
await test("Docs sharing publishes only an expiring read-only snapshot and supports revoke", async () => {
  await asUser(admin);
  const id = (await snapshot("docs")).documents[0].id;
  const doc = (await snapshot("docs", {}, id)).documents[0];
  const token = "e".repeat(64);
  const manage = async (action: string, link?: string, version = doc.version) =>
    (
      await db.query<{ r: any }>(
        "select public.app_doc_share_manage($1,$2,$3,$4,$5,7) r",
        [action, id, link || null, version, token],
      )
    ).rows[0].r;
  const link = await manage("create");
  await asUser(docsReader);
  await assert.rejects(manage("create"));
  await db.exec("reset role;set role anon");
  let publicDoc = (
    await db.query<{ r: any }>("select public.app_share_read($1) r", [token])
  ).rows[0].r;
  assert.equal(publicDoc.title, doc.title);
  assert.equal(publicDoc.notes[0].body, doc.body);
  assert.equal(publicDoc.creator, undefined);
  assert.equal(publicDoc.privileges, undefined);
  await asUser(admin);
  await cmd(
    "update_doc",
    { ...doc, body: "Updated private draft" },
    id,
    doc.version,
  );
  publicDoc = (
    await db.query<{ r: any }>("select public.app_share_read($1) r", [token])
  ).rows[0].r;
  assert.equal(publicDoc.notes[0].body, doc.body);
  await assert.rejects(manage("publish", link.id));
  await manage("publish", link.id, doc.version + 1);
  assert.equal(
    (await db.query<{ r: any }>("select public.app_share_read($1) r", [token]))
      .rows[0].r.notes[0].body,
    "Updated private draft",
  );
  await manage("revoke", link.id, doc.version + 1);
  assert.equal(
    (await db.query<{ r: any }>("select public.app_share_read($1) r", [token]))
      .rows[0].r,
    null,
  );
});
// Live bearer Trip access: actual anonymous RPC calls, not member-session simulations.
const liveToken = "a".repeat(64),
  secondToken = "b".repeat(64),
  viewerToken = "c".repeat(64);
const livePermissions = {
  overview: "view",
  notes: "edit",
  itinerary: "edit",
  contacts: "edit",
  tasks: "edit",
  finance: "edit",
};
let liveLink = "",
  publicTask = "",
  requestId = "",
  otherRequest = "";
async function manageLive(
  action: string,
  token: string | null,
  permissions = livePermissions,
  link: string | null = null,
  version: number | null = null,
) {
  const r = await db.query<{ d: any }>(
    "select public.app_trip_share_manage($1,$2,$3,$4,$5::jsonb,$6,7) d",
    [action, trip, link, version, JSON.stringify(permissions), token],
  );
  return r.rows[0].d;
}
async function anonymous() {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await db.exec("set role anon");
}
async function liveRead(token = liveToken) {
  const r = await db.query<{ d: any }>(
    "select public.app_trip_public_read($1) d",
    [token],
  );
  return r.rows[0].d;
}
async function liveWrite(
  action: string,
  data = {},
  id?: string,
  version?: number,
  token = liveToken,
) {
  const r = await db.query<{ id: string }>(
    "select public.app_trip_public_command($1,$2::jsonb) id",
    [token, JSON.stringify({ action, data, id, version, timezone: "UTC" })],
  );
  return r.rows[0].id;
}
await test("live Trip link management requires Trips edit and Finance sharing requires Finance edit", async () => {
  await asUser(trips);
  await assert.rejects(manageLive("create", liveToken));
  await asUser(admin);
  liveLink = (await manageLive("create", liveToken)).id;
  await manageLive("create", secondToken);
  await manageLive("create", viewerToken, {
    ...livePermissions,
    notes: "view",
    itinerary: "none",
    tasks: "view",
    finance: "view",
  });
  publicTask = await cmd("create_task", {
    context: "trip",
    parent: trip,
    assignee: "public",
    title: "Public only task",
    description: "For guests",
    due: "",
  });
  await cmd("create_task", {
    context: "trip",
    parent: trip,
    assignee: admin,
    title: "INTERNAL TASK NEVER PUBLIC",
    due: "",
  });
});
await test("anonymous live projection hides member tasks, all ledger data and member identity", async () => {
  await anonymous();
  const d = await liveRead();
  assert.equal(d.tasks.length, 1);
  assert.equal(d.tasks[0].id, publicTask);
  assert.equal(d.tasks[0].assignee, "public");
  assert.equal(d.journey.pic, "");
  assert.equal(d.journey.quote, "");
  assert.deepEqual(d.journey.people, []);
  assert.equal(d.transactions, undefined);
  assert.equal(d.tasks[0].created_by, undefined);
  assert.deepEqual((await liveRead(viewerToken)).journey.days, []);
  await assert.rejects(db.query("select * from private.trip_submissions"));
  await assert.rejects(db.query("select * from private.trip_access_links"));
});
await test("public content edit is live, stale writes fail, hidden and viewer tabs reject writes", async () => {
  await anonymous();
  let d = await liveRead();
  const notes = d.journey.notes.map((n: any) => ({
    ...n,
    body: "LIVE PUBLIC UPDATE",
  }));
  await liveWrite("content", { notes }, trip, d.journey.version);
  assert.equal((await liveRead()).journey.notes[0].body, "LIVE PUBLIC UPDATE");
  await assert.rejects(
    liveWrite("content", { notes }, trip, d.journey.version),
  );
  d = await liveRead();
  await assert.rejects(
    liveWrite("content", { notes }, trip, d.journey.version, viewerToken),
  );
  await assert.rejects(
    liveWrite(
      "content",
      { days: d.journey.days },
      trip,
      d.journey.version,
      viewerToken,
    ),
  );
  await assert.rejects(
    liveWrite("content", { notes, contacts: [] }, trip, d.journey.version),
  );
  await assert.rejects(
    liveWrite("update_journey", { quote: "1" }, trip, d.journey.version),
  );
});
await test("public tasks edit only Public tasks in their own Trip, can be reassigned by members", async () => {
  await anonymous();
  let d = await liveRead();
  await liveWrite(
    "task_status",
    { status: "Doing" },
    publicTask,
    d.tasks[0].version,
  );
  await assert.rejects(liveWrite("task_status", { status: "Done" }, task, 1));
  await asUser(admin);
  await cmd(
    "update_task",
    { assignee: admin, title: "Member task now", description: "", due: "" },
    publicTask,
    2,
  );
  await anonymous();
  assert.equal((await liveRead()).tasks.length, 0);
  await assert.rejects(
    liveWrite("task_status", { status: "Done" }, publicTask, 3),
  );
  await asUser(admin);
  await cmd(
    "update_task",
    { assignee: "public", title: "Public again", description: "", due: "" },
    publicTask,
    3,
  );
  await anonymous();
  assert.equal((await liveRead()).tasks.length, 1);
});
const publicCash = {
  title: "Guest expense",
  date: "2020-01-01",
  direction: "out",
  amount: "1234.56",
  category: "out-1",
  description: "Guest receipt",
  idempotency_key: randomUUID(),
};
await test("public transactions remain outside ledger, retry safely, and isolate status by link", async () => {
  await anonymous();
  requestId = await liveWrite("submit_transaction", publicCash);
  assert.equal(await liveWrite("submit_transaction", publicCash), requestId);
  await assert.rejects(
    liveWrite("submit_transaction", { ...publicCash, amount: "999" }),
  );
  await assert.rejects(
    liveWrite(
      "submit_transaction",
      publicCash,
      undefined,
      undefined,
      viewerToken,
    ),
  );
  assert.equal((await liveRead()).submissions[0].status, "pending");
  assert.equal((await liveRead(secondToken)).submissions.length, 0);
  otherRequest = await liveWrite(
    "submit_transaction",
    { ...publicCash, idempotency_key: randomUUID() },
    undefined,
    undefined,
    secondToken,
  );
  await asUser(admin);
  assert.equal(
    (
      await db.query(
        "select id from public.transactions where idempotency_key=$1",
        [requestId],
      )
    ).rows.length,
    0,
  );
  assert.ok(
    (await snapshot("trips", {}, trip)).submissions.some(
      (x: any) => x.id === requestId,
    ),
  );
});
await test("Finance edit member approves public cash exactly once; viewer cannot approve", async () => {
  await asUser(trips);
  await assert.rejects(cmd("approve_submission", {}, requestId, 1));
  await asUser(admin);
  const tx = await cmd("approve_submission", {}, requestId, 1);
  await assert.rejects(cmd("approve_submission", {}, requestId, 1));
  const rows = await db.query<{ amount: string }>(
    "select amount_idr::text amount from public.transactions where id=$1",
    [tx],
  );
  assert.equal(rows.rows[0].amount, "1234.56");
  await anonymous();
  assert.equal((await liveRead()).submissions[0].status, "approved");
  assert.equal((await liveRead()).transactions, undefined);
});
await test("rejection records reason without posting cash and contacts expose approved notes only", async () => {
  await asUser(admin);
  await assert.rejects(
    cmd("reject_submission", { reason: "" }, otherRequest, 1),
  );
  await cmd(
    "reject_submission",
    { reason: "Receipt missing" },
    otherRequest,
    1,
  );
  await anonymous();
  assert.equal(
    (await liveRead(secondToken)).submissions[0].review_reason,
    "Receipt missing",
  );
  const d = await liveRead();
  const contact = {
    id: randomUUID(),
    name: "Guest guide",
    phone: "123",
    email: "guide@example.test",
    note: "PUBLIC CONTACT NOTE",
    role: "",
    organization: "",
  };
  await liveWrite("content", { contacts: [contact] }, trip, d.journey.version);
  assert.equal(
    (await liveRead()).journey.contacts[0].note,
    "PUBLIC CONTACT NOTE",
  );
});
await test("live permissions downgrade, revoke and expired links immediately deny anonymous access", async () => {
  await asUser(admin);
  await manageLive(
    "publish",
    null,
    { ...livePermissions, notes: "none", tasks: "none" },
    liveLink,
    1,
  );
  await anonymous();
  assert.deepEqual((await liveRead()).journey.notes, []);
  assert.deepEqual((await liveRead()).tasks, []);
  await assert.rejects(
    liveWrite("task_status", { status: "Done" }, publicTask, 4),
  );
  await asUser(admin);
  await manageLive("revoke", null, livePermissions, liveLink, 2);
  await anonymous();
  await assert.rejects(liveRead());
  await db.exec("reset role");
  await db.query(
    "update private.trip_access_links set expires_at=now()-interval '1 second' where token_hash=encode(sha256(convert_to($1,'UTF8')),'hex')",
    [secondToken],
  );
  await anonymous();
  await assert.rejects(liveRead(secondToken));
});
console.log(
  `Database regression: ${passed} scenarios passed (embedded PostgreSQL; hosted Auth/email/concurrency remain separate gates).`,
);
await db.close();
await import("./test-refinements-migration");
