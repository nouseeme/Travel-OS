/** Prepare an explicitly destructive, atomic demo reset. Never executes hosted SQL. */
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const w = "10000000-0000-4000-8000-000000000001";
const anchor =
  process.argv.find((x) => x.startsWith("--date="))?.slice(7) ||
  new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor) || !Number.isFinite(Date.parse(anchor)))
  throw Error("Invalid anchor date");
const date = (offset: number) =>
  new Date(Date.parse(anchor) + offset * 86400000).toISOString().slice(0, 10);
const stamp = (offset: number) => date(offset) + "T08:00:00Z";
const q = (v: unknown): string =>
  v === null || v === undefined
    ? "NULL"
    : typeof v === "number" || typeof v === "boolean"
      ? String(v)
      : "'" +
        (typeof v === "object" ? JSON.stringify(v) : String(v)).replaceAll(
          "'",
          "''",
        ) +
        "'";
const statements: string[] = [
  "begin;",
  "set local lock_timeout='10s';",
  "select id from public.workspaces for update;",
  `do $$begin if (select count(*) from public.workspaces)<>1 or not exists(select 1 from public.workspaces where id='${w}') then raise exception 'Expected single Travel OS workspace';end if;if exists(select 1 from storage.objects) then raise exception 'Storage objects need separate review';end if;end$$;`,
];
const insert = (table: string, row: Record<string, unknown>) =>
  statements.push(
    `insert into ${table} (${Object.keys(row).join(",")}) values (${Object.entries(
      row,
    )
      .map(([k, v]) =>
        table === "public.templates" && k === "content" && typeof v === "string"
          ? q(JSON.stringify(v))
          : q(v),
      )
      .join(",")});`,
  );
// Remove application references first; Auth cascades remove identities, refresh tokens and MFA.
for (const table of [
  "private.trip_submissions",
  "private.trip_access_links",
  "private.doc_share_links",
  "private.contact_share_links",
  "private.share_snapshots",
  "private.share_links",
  "private.share_rate",
  "private.invitations",
  "private.audit_events",
  "public.transaction_corrections",
  "public.trip_budgets",
  "public.transactions",
  "public.tasks",
  "public.journeys",
  "public.internal_docs",
  "public.user_preferences",
  "private.internal_contacts",
  "public.memberships",
  "auth.sessions",
  "auth.users",
  "public.templates",
  "public.sales_stages",
  "public.trip_stages",
  "public.finance_categories",
])
  statements.push(`delete from ${table};`);
statements.push(
  `select private.seed_p1('${w}');select private.seed_trip_stages('${w}');`,
);
const seed = await readFile("supabase/seed.sql", "utf8");
statements.push(seed);
const privileges = (
  sales = "edit",
  trips = "edit",
  finance = "edit",
  docs = "edit",
) => ({ sales, trips, finance, docs });
const staff = [
  { name: "Alya Pratama · Demo Operations", priv: privileges() },
  {
    name: "Bima Santoso · Demo Sales",
    priv: privileges("edit", "view", "none", "view"),
  },
  {
    name: "Citra Lestari · Demo Finance",
    priv: privileges("view", "view", "edit", "view"),
  },
  {
    name: "Dewi Ananda · Demo Viewer",
    priv: privileges("view", "view", "view", "view"),
  },
  {
    name: "Eko Putra · Demo Home Only",
    priv: privileges("none", "none", "none", "none"),
  },
  { name: "Farah Wijaya · Demo Former Admin", priv: privileges() },
  {
    name: "Gilang Saputra · Demo Invitee",
    priv: privileges("none", "view", "none", "none"),
  },
].map((s, i) => ({
  ...s,
  id: randomUUID(),
  email: `demo.staff.${i + 1}@example.invalid`,
}));
for (const [i, s] of staff.entries()) {
  insert("auth.users", {
    id: s.id,
    instance_id: "00000000-0000-0000-0000-000000000000",
    aud: "authenticated",
    role: "authenticated",
    email: s.email,
    encrypted_password: "",
    banned_until: "2099-12-31T00:00:00Z",
    raw_app_meta_data: { demo_fixture: true },
    raw_user_meta_data: { name: s.name },
    created_at: stamp(-180),
    updated_at: stamp(-1),
  });
  insert("public.memberships", {
    id: s.id,
    workspace_id: w,
    name: s.name,
    email: s.email,
    role: i === 5 ? "admin" : "member",
    status: i === 5 ? "deactivated" : i === 6 ? "invited" : "active",
    privileges: s.priv,
  });
  if (i < 4)
    insert("public.user_preferences", {
      user_id: s.id,
      trip_view: i % 2 ? "calendar" : "board",
    });
}
const actor = staff[0].id,
  historicalAdmin = staff[5].id;
const audit = (
  action: string,
  entity: string,
  at: string,
  before: unknown,
  after: unknown,
  by = actor,
) =>
  insert("private.audit_events", {
    workspace_id: w,
    actor: by,
    action,
    entity,
    at,
    metadata: { before, after, demo_fixture: true },
  });
const contact = (name: string, i = 0) => ({
  id: randomUUID(),
  name,
  role: i === 0 ? "Client coordinator" : "Vendor",
  organization: i === 0 ? "Fictional client" : "Fictional travel partner",
  phone: "",
  email: `contact.${randomUUID().slice(0, 8)}@example.invalid`,
  note: "Fictional demo contact. Communicate by email; no real phone number.",
});
const internalContacts = Array.from({ length: 18 }, (_, i) =>
  contact(
    [
      "Rani · Hotel desk",
      "Yoga · Transport",
      "Sari · Local guide",
      "Adi · Catering",
      "Nadia · Emergency desk",
      "Tono · Ticketing",
    ][i % 6] + ` ${i + 1}`,
    1,
  ),
);
insert("private.internal_contacts", {
  workspace_id: w,
  contacts: internalContacts,
  version: 3,
});
type Journey = {
  id: string;
  kind: string;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
  workspace_id: string;
  version: number;
  source_lead: string | null;
};
const journeys: Journey[] = [];
const destinations = [
  "Bali",
  "Yogyakarta",
  "Lombok",
  "Bandung",
  "Labuan Bajo",
  "Malang",
  "Jakarta",
  "Solo",
];
function journey(
  kind: string,
  index: number,
  stage: string,
  lifecycle: string,
  start: number,
  source: string | null = null,
): Journey {
  const id = randomUUID(),
    dest = destinations[index % destinations.length],
    archived = lifecycle !== "active";
  const data = {
    kind,
    name: `${dest} ${kind === "lead" ? "Proposal" : "Journey"} · ${String(index + 1).padStart(2, "0")}`,
    client: [
      "PT Lentera Demo",
      "Komunitas Awan Demo",
      "Keluarga Melati Demo",
      "Universitas Cakrawala Demo",
    ][index % 4],
    pic: kind === "lead" ? staff[1].id : actor,
    people: kind === "trip" ? [actor, staff[3].id] : [],
    stage,
    lifecycle,
    trip_type: [
      "Corporate retreat",
      "Family holiday",
      "Study tour",
      "Community trip",
    ][index % 4],
    client_type: ["Corporate", "Community", "Individual", "Education"][
      index % 4
    ],
    start: date(start),
    end: date(start + 2),
    guests: 12 + (index % 5) * 6,
    quote: String(18000000 + index * 750000) + ".50",
    notes: [
      {
        id: randomUUID(),
        title: "Brief & preferences",
        body: `## ${dest} travel brief\n\nFictional demo booking for ${12 + (index % 5) * 6} guests.\n\n- Vegetarian meals: 3 guests\n- Accessible transport requested\n- Quiet rooms preferred\n\n### Follow-up\nConfirm rooming list and transport manifest before departure.`,
      },
      {
        id: randomUUID(),
        title: "Operations & decisions",
        body: "## Vendor confirmation\n\n| Service | Decision | Owner |\n| --- | --- | --- |\n| Hotel | Twin sharing, breakfast included | Operations |\n| Coach | 30 seats, luggage allowance agreed | Transport |\n\n- [x] Initial quotation reviewed\n- [x] Client requirements recorded\n- [ ] Final headcount reconfirmation\n\n**Demo history:** quotation revised after client feedback.",
      },
    ],
    contacts: [
      contact("Maya · Client coordinator"),
      contact(`Wayan · ${dest} hotel`, 1),
      contact(`Andi · ${dest} driver`, 1),
    ],
    days: Array.from({ length: 3 }, (_, d) => ({
      id: randomUUID(),
      title: ["Arrival & orientation", "Main programme", "Checkout & return"][
        d
      ],
      items: [
        {
          id: randomUUID(),
          name: [
            "Airport pickup",
            "Guided destination visit",
            "Hotel checkout",
          ][d],
          description:
            "08:00 — Meet at the agreed point. Allow 30 minutes for the guest count and briefing.",
        },
        {
          id: randomUUID(),
          name: ["Welcome lunch", "Workshop & free time", "Return transfer"][d],
          description:
            "## Arrangements\n\nMeal included. Confirm dietary restrictions with the coordinator.\n\n- Transport manifest checked\n- Emergency contact briefed",
        },
        {
          id: randomUUID(),
          name: ["Hotel check-in", "Group dinner", "Departure"][d],
          description:
            "17:00 — Coordinator confirms the next step in the shared itinerary.",
        },
      ],
    })),
    source_lead: source,
    converted_trip: null,
    archived_at: archived ? stamp(Math.min(start + 4, -1)) : null,
    lost_reason:
      lifecycle === "lost"
        ? "Client selected another provider after budget review"
        : "",
  };
  const row = {
    id,
    workspace_id: w,
    kind,
    data,
    source_lead: source,
    version: archived ? 5 : 3,
    created_at: stamp(Math.min(start - 25, -1)),
    updated_at: stamp(Math.min(start + 4, -1)),
  };
  journeys.push(row);
  return row;
}
for (let i = 0; i < 24; i++)
  journey(
    "lead",
    i,
    ["Drafts", "Contacted", "Prospect"][i % 3],
    i < 18 ? "active" : i < 21 ? "lost" : "archived",
    10 + i * 3,
  );
for (let i = 0; i < 20; i++) {
  const stage =
    i < 12
      ? "Completed"
      : i < 14
        ? "Cancelled"
        : i < 16
          ? "In Progress"
          : i < 18
            ? "Confirmed"
            : "Planned";
  const start =
    i < 14
      ? -165 + i * 11
      : i < 16
        ? -1
        : i < 18
          ? 7 + (i - 16) * 4
          : 22 + (i - 18) * 10;
  const lead = journey("lead", 24 + i, "Prospect", "converted", start);
  const trip = journey(
    "trip",
    i,
    stage,
    i < 14 ? "archived" : "active",
    start,
    lead.id,
  );
  lead.data.converted_trip = trip.id;
  lead.data.archived_at = stamp(Math.min(start - 18, -1));
  lead.updated_at = lead.data.archived_at;
}
// Sources must precede their trips for the FK; lead conversion linkage is JSON.
for (const j of journeys) {
  insert("public.journeys", j);
  audit("create_journey", j.id, j.created_at, null, {
    kind: j.kind,
    name: j.data.name,
    stage: j.kind === "lead" ? "Drafts" : "Planned",
  });
  audit(
    j.data.lifecycle === "converted"
      ? "convert"
      : j.data.lifecycle === "lost"
        ? "archive"
        : "stage",
    j.id,
    j.updated_at,
    { stage: j.kind === "lead" ? "Drafts" : "Planned" },
    { stage: j.data.stage, lifecycle: j.data.lifecycle },
  );
}
const tasks: Record<string, any>[] = [];
function task(
  parent: Journey | null,
  i: number,
  status: string,
  due: number,
  publicTask = false,
  cancelled = false,
) {
  const id = randomUUID(),
    assigned = publicTask
      ? null
      : parent?.kind === "lead"
        ? staff[1].id
        : actor;
  const created = parent ? parent.created_at : stamp(-170 + i * 3);
  const terminal = parent && parent.data.lifecycle !== "active";
  const completedAt =
    status === "Done" ? (parent ? parent.updated_at : stamp(-3)) : null;
  const row = {
    id,
    workspace_id: w,
    parent: parent?.id || null,
    assignee: assigned,
    version: status === "Assigned" ? 1 : 3,
    created_at: created,
    updated_at: completedAt || stamp(-1),
    data: {
      title:
        [
          "Confirm guest manifest",
          "Review supplier quotation",
          "Finalize itinerary",
          "Check dietary preferences",
          "Reconcile receipts",
          "Send departure briefing",
        ][i % 6] + (parent ? ` · ${parent.data.name}` : ` · Internal ${i + 1}`),
      description:
        "Demo operational task. Check the linked brief, record the decision, and confirm with the coordinator.",
      status,
      assignee: publicTask ? "public" : assigned,
      due: terminal ? parent.data.end : date(due),
      context: parent?.kind || "internal",
      parent: parent?.id || null,
      completed_at: completedAt,
      cancelled_at: cancelled ? stamp(-1) : null,
      created_by: actor,
    },
  };
  tasks.push(row);
  insert("public.tasks", row);
  audit("create_task", id, created, null, {
    title: row.data.title,
    status: "Assigned",
  });
  if (status !== "Assigned")
    audit(
      "task_status",
      id,
      row.updated_at,
      { status: "Assigned" },
      { status },
    );
}
for (const [i, j] of journeys.entries())
  for (let k = 0; k < 4; k++)
    task(
      j,
      i + k,
      j.data.lifecycle === "active"
        ? ["Assigned", "Doing", "Done", "Assigned"][k]
        : "Done",
      [-4, 0, 1, 8][k],
      j.kind === "trip" && k === 3,
      j.data.stage === "Cancelled" && k === 3,
    );
for (let i = 0; i < 36; i++)
  task(
    null,
    i,
    ["Assigned", "Doing", "Done"][i % 3],
    [-12, -3, 0, 1, 2, 15][i % 6],
    false,
    i === 35,
  );
// Reassignment queue: create an eligible task, then deactivate its historical assignee.
const reassignment = tasks.find(
  (t) => t.parent === null && t.data.status === "Assigned",
)!;
statements.push(
  `update public.tasks set assignee=${q(staff[3].id)},data=data||jsonb_build_object('assignee',${q(staff[3].id)}) where id=${q(reassignment.id)};`,
);
// Viewer remains active; use former admin temporarily active to assign another historical task.
statements.push(
  `update public.memberships set status='active' where id=${q(historicalAdmin)};`,
);
const queueTask = tasks.find(
  (t) => t.parent === null && t.data.status === "Doing",
)!;
statements.push(
  `update public.tasks set assignee=${q(historicalAdmin)},data=data||jsonb_build_object('assignee',${q(historicalAdmin)}) where id=${q(queueTask.id)};update public.memberships set status='deactivated' where id=${q(historicalAdmin)};`,
);
const trips = journeys.filter((j) => j.kind === "trip");
// Move an unfinished task to the converted Trip, retaining its ID and recording both contexts.
const transferred = tasks.find(
  (t) => t.parent === trips[14].id && t.data.status === "Doing",
)!;
audit(
  "convert",
  trips[14].source_lead!,
  trips[14].created_at,
  { task: transferred.id, context: "lead", parent: trips[14].source_lead },
  { task: transferred.id, context: "trip", parent: trips[14].id },
);
audit(
  "trip_auto_progress",
  trips[14].id,
  stamp(-3),
  { stage: "Confirmed" },
  { stage: "In Progress", rule: "H-2" },
);
// Dedicated no-cash and budget-only cases, each with complete operational documents.
for (let i = 0; i < 2; i++) {
  const extra = journey("trip", 20 + i, "Planned", "active", 40 + i * 7);
  extra.data.name = i
    ? "Lombok Budget Only · Demo"
    : "Bandung Awaiting Deposit · Demo";
  insert("public.journeys", extra);
  audit("create_journey", extra.id, extra.created_at, null, {
    name: extra.data.name,
    stage: "Planned",
  });
  for (let k = 0; k < 3; k++)
    task(extra, k, ["Assigned", "Doing", "Done"][k], [0, 1, 5][k]);
  if (i)
    insert("public.trip_budgets", {
      workspace_id: w,
      trip_id: extra.id,
      category_id: "out-1",
      amount_idr: 4000000,
      created_at: extra.created_at,
      updated_at: extra.created_at,
    });
}
const transactions: Record<string, any>[] = [];
function transaction(
  trip: Journey | null,
  category: string,
  amount: string,
  offset: number,
  title: string,
  voided = false,
) {
  const id = randomUUID(),
    key = randomUUID(),
    direction = category.startsWith("in") ? "in" : "out",
    at = stamp(offset);
  const data = {
    title,
    date: date(offset),
    direction,
    amount,
    category,
    trip: trip?.id || null,
    description: `Fictional demo receipt — ${title}. Cash recorded in IDR.`,
    status: voided ? "void" : "posted",
    created_by: staff[2].id,
    void_by: voided ? historicalAdmin : null,
    void_at: voided ? stamp(offset + 1) : null,
    reason: voided
      ? "Duplicate vendor receipt; void approved by former demo admin"
      : "",
    idempotency_key: key,
  };
  const row = {
    id,
    workspace_id: w,
    trip: trip?.id || null,
    amount_idr: amount,
    transaction_date: date(offset),
    direction,
    category_id: category,
    idempotency_key: key,
    data,
    version: voided ? 2 : 1,
    created_at: at,
    updated_at: voided ? stamp(offset + 1) : at,
  };
  transactions.push(row);
  insert("public.transactions", row);
  audit(
    "create_transaction",
    id,
    at,
    null,
    { title, amount, category, trip: trip?.id || null },
    staff[2].id,
  );
  if (voided)
    audit(
      "void_transaction",
      id,
      row.updated_at,
      { status: "posted" },
      { status: "void", reason: data.reason },
      historicalAdmin,
    );
  return row;
}
for (const [i, t] of trips.entries()) {
  const start = Math.round(
      (Date.parse(t.data.start) - Date.parse(anchor)) / 86400000,
    ),
    at = Math.min(start - 15, -5);
  transaction(
    t,
    "in-0",
    String(9000000 + i * 100000),
    at,
    "Client deposit · " + t.data.name,
  );
  if (i < 12)
    transaction(
      t,
      "in-1",
      String(11000000 + i * 300000),
      start,
      "Client final payment · " + t.data.name,
    );
  for (let c = 0; c < 5; c++)
    transaction(
      t,
      `out-${c}`,
      String((i === 2 ? 7000000 : 1500000) + c * 550000 + i * 10000) +
        (c === 2 ? ".75" : ""),
      Math.min(start + c, -1),
      ["Coach charter", "Hotel payment", "Meals", "Activities", "Guide fee"][
        c
      ] +
        " · " +
        t.data.name,
    );
  if (i === 12 || i === 13)
    transaction(
      t,
      "out-7",
      "9000000",
      Math.min(start + 3, -1),
      "Cancellation refund · " + t.data.name,
    );
  if (i < 3)
    transaction(
      t,
      "out-1",
      "500000",
      start + 1,
      "Duplicate hotel receipt · " + t.data.name,
      true,
    );
  for (const c of [
    "in-0",
    "in-1",
    "out-0",
    "out-1",
    "out-2",
    "out-3",
    "out-4",
    "out-6",
  ])
    insert("public.trip_budgets", {
      workspace_id: w,
      trip_id: t.id,
      category_id: c,
      amount_idr:
        c === "in-0"
          ? 9000000
          : c === "in-1"
            ? 13000000
            : c === "out-6"
              ? 0
              : 3000000,
      version: 2,
      created_at: t.created_at,
      updated_at: t.created_at,
    });
}
for (let month = 0; month < 6; month++)
  for (const [c, a, label] of [
    ["in-3", "15000000", "Owner capital"],
    ["in-4", "5000000", "Working capital loan"],
    ["in-2", "250000.25", "Referral fee"],
    ["out-5", "1200000", "Marketing campaign"],
    ["out-6", "875000.50", "Office operations"],
    ["out-8", "1000000", "Owner withdrawal"],
    ["out-9", "500000", "Loan repayment"],
  ])
    transaction(null, c, a, -165 + month * 28, label);
for (const [i, status] of ["pending", "approved", "rejected"].entries()) {
  const tx = transactions[i * 7 + 2],
    original = { ...tx.data },
    proposed = {
      ...original,
      amount: i === 0 ? "2100000.50" : i === 1 ? "2300000.25" : "1900000",
      reason: "Supplier receipt reconciliation",
    };
  if (status === "approved")
    statements.push(
      `update public.transactions set data=${q({ ...proposed, confirmed_by: historicalAdmin, confirmed_at: stamp(-3) })},amount_idr=${q(proposed.amount)},version=2,updated_at=${q(stamp(-3))} where id=${q(tx.id)};`,
    );
  const id = randomUUID();
  insert("public.transaction_corrections", {
    id,
    workspace_id: w,
    transaction_id: tx.id,
    transaction_version: 1,
    proposed,
    original,
    reason: "Correct amount after matching supplier receipt",
    requested_by: staff[2].id,
    status,
    reviewed_by: status === "pending" ? null : historicalAdmin,
    reviewed_at: status === "pending" ? null : stamp(-3),
    review_reason:
      status === "rejected"
        ? "Receipt does not support proposed amount"
        : status === "approved"
          ? "Verified against invoice"
          : null,
    version: status === "pending" ? 1 : 2,
    created_at: stamp(-4),
    updated_at: stamp(-3),
  });
  audit(
    status === "pending"
      ? "edit_transaction"
      : status === "approved"
        ? "approve_correction"
        : "reject_correction",
    tx.id,
    stamp(-3),
    original,
    status === "approved" ? proposed : original,
    status === "pending" ? staff[2].id : historicalAdmin,
  );
}
const documents = Array.from({ length: 32 }, (_, i) => ({
  id: randomUUID(),
  workspace_id: w,
  title:
    [
      "Supplier onboarding checklist",
      "Departure briefing SOP",
      "Monthly cash review",
      "Incident response guide",
      "Team meeting decisions",
      "Client handover notes",
      "Cancellation & refund policy",
      "Post-trip evaluation",
    ][i % 8] + ` · Edition ${1 + Math.floor(i / 8)}`,
  date: date(-170 + i * 5),
  creator: staff[i % 4].id,
  category: ["Operations", "Finance", "Meeting", "Policy"][i % 4],
  body: `# Demo knowledge base\n\nThis is fictional material for platform review.\n\n## Purpose\nKeep bookings, guest requirements and supplier decisions aligned.\n\n## Checklist\n- [x] Coordinator assigned\n- [x] Guest preferences recorded\n- [ ] Final review before departure\n\n| Check | Owner | Evidence |\n| --- | --- | --- |\n| Transport | Operations | Manifest |\n| Payment | Finance | Receipt |\n\n## Decisions\nUse the current itinerary and escalate unresolved supplier issues to the coordinator.\n\n## Follow-up\nReview during the next monthly operations meeting.`,
  version: (i % 3) + 1,
  created_at: stamp(-170 + i * 5),
  updated_at: stamp(Math.min(-170 + i * 5 + 2, -1)),
}));
for (const d of documents) {
  insert("public.internal_docs", d);
  audit("create_doc", d.id, d.created_at, null, {
    title: d.title,
    category: d.category,
  });
  if (d.version > 1)
    audit(
      "update_doc",
      d.id,
      d.updated_at,
      { title: d.title, body: "Earlier demo revision" },
      { title: d.title, body: d.body },
    );
}
for (const kind of ["lead_note", "trip_note", "internal_doc", "itinerary"])
  for (let i = 0; i < 2; i++)
    insert("public.templates", {
      workspace_id: w,
      name: `${i ? "Retired" : "Standard"} demo ${kind}`,
      kind,
      content:
        kind === "itinerary"
          ? [
              {
                title: "Arrival",
                items: [
                  {
                    name: "Pickup & briefing",
                    description:
                      "Meet guests, verify manifest, confirm programme.",
                  },
                ],
              },
              {
                title: "Programme",
                items: [
                  {
                    name: "Guided visit",
                    description:
                      "Confirm route, meals and return arrangements.",
                  },
                ],
              },
            ]
          : "## Summary\n\n## Decisions\n\n- [ ] Follow-up\n\n## Risks",
      active: i === 0,
      version: i + 1,
    });
// Retired configuration keeps historical references; active defaults remain intact.
insert("public.sales_stages", {
  id: "demo-retired-stage",
  workspace_id: w,
  key: "demo-retired-stage",
  label: "Legacy qualified",
  position: 3,
  active: false,
  is_default: false,
  version: 2,
});
insert("public.finance_categories", {
  id: "out-demo-retired",
  name: "Legacy booking fee (demo)",
  direction: "out",
  active: false,
  version: 2,
});
transaction(trips[0], "out-demo-retired", "150000", -160, "Legacy booking fee");
const breakEven = journey("trip", 22, "Completed", "archived", -35);
breakEven.data.name = "Solo Break-even · Demo";
insert("public.journeys", breakEven);
for (let k = 0; k < 3; k++) task(breakEven, k, "Done", -35 + k);
transaction(breakEven, "in-1", "6000000", -35, "Fully paid small group");
transaction(
  breakEven,
  "out-1",
  "6000000",
  -34,
  "Break-even accommodation cost",
);
for (const [i, status] of [
  "pending",
  "sent",
  "failed",
  "accepted",
  "revoked",
  "sent",
].entries())
  insert("private.invitations", {
    workspace_id: w,
    email:
      i === 3
        ? staff[3].email
        : i === 1
          ? staff[6].email
          : `demo.invite.${i}@example.invalid`,
    name: [
      "Pending coordinator",
      "Invited guide",
      "Delivery failed assistant",
      "Accepted viewer",
      "Revoked freelancer",
      "Expired invitation",
    ][i],
    privileges: privileges("none", "view", "none", "none"),
    status,
    provider_user: i === 3 ? staff[3].id : i === 1 ? staff[6].id : null,
    invited_by: historicalAdmin,
    created_at: stamp(i === 5 ? -15 : -3),
    expires_at: stamp(i === 5 ? -8 : 4),
    delivery_channel: "manual",
    version: i === 3 || i === 4 ? 2 : 1,
  });
const links: { label: string; url: string; trip?: string }[] = [];
function token(label: string, path: string, trip?: string) {
  const raw = randomBytes(32).toString("hex");
  links.push({ label, url: `http://127.0.0.1:3000/${path}/${raw}`, trip });
  return createHash("sha256").update(raw).digest("hex");
}
const sharedTrip = trips[14];
const levels = [
  {
    overview: "view",
    tasks: "none",
    notes: "none",
    itinerary: "view",
    contacts: "none",
    finance: "none",
  },
  {
    overview: "edit",
    tasks: "edit",
    notes: "edit",
    itinerary: "edit",
    contacts: "edit",
    finance: "edit",
  },
  {
    overview: "view",
    tasks: "view",
    notes: "view",
    itinerary: "view",
    contacts: "view",
    finance: "view",
  },
];
const liveLinks: string[] = [];
for (let i = 0; i < 6; i++) {
  const id = randomUUID(),
    t = i === 5 ? trips[0] : sharedTrip,
    label = [
      "Trip viewer with hidden tabs",
      "Trip editor / public tasks / finance submissions",
      "Trip all tabs viewer",
      "Expired Trip link",
      "Revoked Trip link",
      "Completed Trip read-only",
    ][i];
  liveLinks.push(id);
  insert("private.trip_access_links", {
    id,
    workspace_id: w,
    trip_id: t.id,
    token_hash: token(label, "shared-trip", t.data.name),
    permissions: levels[i % 3],
    expires_at: stamp(i === 3 ? -1 : 25),
    revoked_at: i === 4 ? stamp(-1) : null,
    created_by: actor,
    version: i === 4 ? 2 : 1,
  });
  audit(
    i === 4 ? "trip_share_revoke" : "trip_share_create",
    t.id,
    stamp(-2),
    null,
    { link: id, permissions: levels[i % 3] },
  );
}
for (const [i, status] of ["pending", "approved", "rejected"].entries()) {
  const tx =
    status === "approved"
      ? transaction(
          sharedTrip,
          "out-2",
          "325000.50",
          -1,
          "Public supplier meal receipt",
        )
      : null;
  insert("private.trip_submissions", {
    link_id: liveLinks[1],
    workspace_id: w,
    trip_id: sharedTrip.id,
    data: {
      title: "Public supplier meal receipt " + (i + 1),
      date: date(-1),
      direction: "out",
      amount: "325000.50",
      category: "out-2",
      description: "Fictional supplier cash receipt",
    },
    idempotency_key: randomUUID(),
    status,
    reviewed_by: i ? staff[2].id : null,
    review_reason:
      i === 2 ? "Duplicate receipt" : i === 1 ? "Receipt verified" : "",
    transaction_id: tx?.id || null,
    version: i ? 2 : 1,
    created_at: stamp(-1),
    updated_at: stamp(-1),
  });
}
for (let i = 0; i < 4; i++) {
  const d = documents[i],
    label = [
      "Shared Doc snapshot",
      "Expired Doc snapshot",
      "Revoked Doc snapshot",
      "Updated Doc snapshot",
    ][i];
  insert("private.doc_share_links", {
    workspace_id: w,
    doc_id: d.id,
    token_hash: token(label, "share"),
    payload: {
      kind: "internal_doc",
      title: d.title,
      notes: [{ title: "", body: d.body }],
      contacts: [],
    },
    expires_at: stamp(i === 1 ? -1 : 25),
    revoked_at: i === 2 ? stamp(-1) : null,
    created_by: actor,
    version: i === 3 ? 2 : 1,
  });
}
for (let i = 0; i < 3; i++)
  insert("private.contact_share_links", {
    workspace_id: w,
    token_hash: token(
      [
        "Shared Contacts snapshot",
        "Expired Contacts snapshot",
        "Revoked Contacts snapshot",
      ][i],
      "share",
    ),
    payload: {
      kind: "internal_contacts",
      title: "Demo Contacts",
      notes: [],
      contacts: internalContacts,
    },
    expires_at: stamp(i === 1 ? -1 : 25),
    revoked_at: i === 2 ? stamp(-1) : null,
    created_by: actor,
  });
audit(
  "deactivate",
  historicalAdmin,
  stamp(-1),
  { status: "active" },
  {
    status: "deactivated",
    reason: "Former fictional admin; first real admin bootstrap reserved",
  },
  historicalAdmin,
);
statements.push(
  `do $$begin if exists(select 1 from public.memberships where role='admin' and status='active') then raise exception 'First admin slot must remain available';end if;if exists(select 1 from auth.users where coalesce(encrypted_password,'')<>'') then raise exception 'Demo users must not have login credentials';end if;end$$;`,
);
statements.push("commit;");
await mkdir(".local/demo", { recursive: true });
await writeFile(".local/demo/reset.sql", statements.join("\n"));
await writeFile(
  ".local/demo/links.json",
  JSON.stringify({ anchor, links }, null, 2),
);
await writeFile(
  ".local/demo/manifest.json",
  JSON.stringify(
    {
      anchor,
      workspace: w,
      staff: staff.map((s) => ({ id: s.id, name: s.name, email: s.email })),
      journeys: journeys.length,
      leads: journeys.filter((j) => j.kind === "lead").length,
      trips: journeys.filter((j) => j.kind === "trip").length,
      tasks: tasks.length,
      transactions: transactions.length,
      documents: documents.length,
      links: links.length,
    },
    null,
    2,
  ),
);
// Test actual SQL with every migration and the same validation triggers before hosted execution.
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,encrypted_password text,instance_id uuid,aud text,role text,banned_until timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb,created_at timestamptz,updated_at timestamptz);create table auth.sessions(id uuid);create schema storage;create table storage.objects(id uuid);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
);
for (const f of (await readdir("supabase/migrations"))
  .filter((x) => x.endsWith(".sql"))
  .sort())
  await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
await db.exec(seed);
for (const [index, statement] of statements.entries()) {
  try {
    await db.exec(statement);
  } catch (error) {
    console.error(
      "Statement",
      index,
      statement.slice(0, 150),
      (error as Error).message,
    );
    await db.close();
    process.exit(1);
  }
}
const counts = await db.query(
  "select (select count(*) from public.journeys) journeys,(select count(*) from public.tasks) tasks,(select count(*) from public.transactions) transactions,(select count(*) from public.internal_docs) documents",
);
console.log("Demo SQL validated against all migrations:", counts.rows[0]);
// Read projections as an admin and then roll back the temporary activation.
await db.exec("begin;");
await db.exec(
  `update public.memberships set status='active' where id=${q(historicalAdmin)};select set_config('request.jwt.claim.sub',${q(historicalAdmin)},false);set local role authenticated;`,
);
for (const view of ["home", "sales", "trips", "finance", "docs", "people"]) {
  try {
    await db.query("select public.app_snapshot($1,'{}'::jsonb,null)", [view]);
  } catch (error) {
    console.error("Projection", view, (error as Error).message);
    process.exit(1);
  }
}
await db.exec("rollback;");
console.log(
  "Admin projections validated for Home, Sales, Trips, Finance, Docs and People.",
);
await db.close();
