import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { randomUUID } from "node:crypto";
import type {
  Journey,
  Snapshot,
  Person,
  Command,
  Transaction,
} from "../src/lib/model";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://127.0.0.1:3000",
  pretendToBeVisual: true,
});
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: dom.window,
});
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: dom.window.document,
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
Object.defineProperty(globalThis, "HTMLElement", {
  configurable: true,
  value: dom.window.HTMLElement,
});
Object.defineProperty(globalThis, "getComputedStyle", {
  configurable: true,
  value: dom.window.getComputedStyle.bind(dom.window),
});
for (const name of [
  "Node",
  "Element",
  "MutationObserver",
  "CustomEvent",
  "NodeFilter",
  "HTMLInputElement",
] as const)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: dom.window[name],
  });
const { render, fireEvent, cleanup, waitFor, act } =
  await import("@testing-library/react");
const { Detail } = await import("../src/components/detail");
const { default: RichEditorClient } =
  await import("../src/components/rich-editor-client");
const { Budget, AuditDiff } = await import("../src/components/p2");
const { Board } = await import("../src/components/board");
const { MoneyInput } = await import("../src/components/money-input");
const { Ledger } = await import("../src/components/dashboard");
const { InternalDocs } = await import("../src/components/internal-docs");
const { Contacts } = await import("../src/components/detail");
const { InternalContacts } =
  await import("../src/components/internal-contacts");
test("contacts return to a table after save and retain inputs after a failed save", async () => {
  for (const saved of [false, true]) {
    const ui = render(
      <Contacts
        j={journey}
        edit
        busy={false}
        run={async () => saved}
        dirty={() => {}}
      />,
    );
    fireEvent.click(ui.getByRole("button", { name: "Edit contacts" }));
    fireEvent.change(ui.getByRole("textbox", { name: "Nama contact" }), {
      target: { value: "Updated contact" },
    });
    await act(async () =>
      fireEvent.click(ui.getByRole("button", { name: "Simpan contacts" })),
    );
    assert.equal(
      Boolean(ui.queryByRole("textbox", { name: "Nama contact" })),
      !saved,
    );
    assert.ok(
      ui.getByText(saved ? "Updated contact" : "Perubahan belum disimpan."),
    );
    cleanup();
  }
});

test("CRM and Trip can save a newly typed contact absent from the database", async () => {
  for (const kind of ["lead", "trip"] as const) {
    let command: Command | undefined;
    const draft: Journey = { ...journey, kind, contacts: [] };
    const ui = render(
      <Contacts
        j={draft}
        edit
        initialEditing
        busy={false}
        directory={[]}
        dirty={() => {}}
        run={async (c) => {
          command = c;
          return true;
        }}
      />,
    );
    try {
      fireEvent.click(ui.getByRole("button", { name: /^Contact$/ }));
      const name = ui.getByRole("combobox", {
        name: "Nama contact",
      }) as HTMLInputElement;
      fireEvent.change(name, { target: { value: "Vendor Baru Bandung" } });
      assert.equal(
        name.value,
        "Vendor Baru Bandung",
        "Typing must update the actual contact draft",
      );
      assert.equal(ui.queryByRole("dialog"), null);
      const addNew = ui.getByRole("option", {
        name: /Tambah kontak baru “Vendor Baru Bandung”/,
      });
      if (kind === "lead") fireEvent.click(addNew);
      else fireEvent.keyDown(name, { key: "Escape" });
      assert.equal(ui.queryByRole("listbox"), null);
      assert.equal(name.value, "Vendor Baru Bandung");
      fireEvent.change(ui.getByRole("textbox", { name: "Email contact" }), {
        target: { value: "vendor.baru@example.test" },
      });
      assert.equal(
        (
          ui.getByRole("button", {
            name: "Simpan contacts",
          }) as HTMLButtonElement
        ).disabled,
        false,
      );
      await act(async () =>
        fireEvent.click(ui.getByRole("button", { name: "Simpan contacts" })),
      );
      const saved = (command?.data?.contacts as Journey["contacts"])[0];
      assert.equal(saved.name, "Vendor Baru Bandung");
      assert.equal(saved.email, "vendor.baru@example.test");
    } finally {
      cleanup();
    }
  }
});

test("contact database picker reuses the saved UUID and prevents duplicate selection", async () => {
  const existing = {
    ...journey.contacts[0],
    id: randomUUID(),
    name: "Saved vendor",
    version: 7,
    source: "Internal",
    source_kind: "internal" as const,
    source_id: null,
  };
  let command: Command | undefined;
  const ui = render(
    <Contacts
      j={journey}
      edit
      busy={false}
      directory={[existing]}
      dirty={() => {}}
      run={async (c) => {
        command = c;
        return true;
      }}
    />,
  );
  try {
    fireEvent.click(ui.getByRole("button", { name: "Edit contacts" }));
    assert.equal(ui.queryByRole("button", { name: "Add from database" }), null);
    fireEvent.click(ui.getByRole("button", { name: /^Contact$/ }));
    const name = ui.getByRole("combobox", { name: "Nama contact" });
    fireEvent.change(name, { target: { value: "Saved" } });
    assert.equal(ui.queryByRole("dialog"), null);
    assert.ok(ui.getByRole("option", { name: /^Saved vendor/ }));
    fireEvent.keyDown(name, { key: "ArrowDown" });
    fireEvent.keyDown(name, { key: "Enter" });
    await act(async () =>
      fireEvent.click(ui.getByRole("button", { name: "Simpan contacts" })),
    );
    assert.ok(
      (command?.data?.contacts as Journey["contacts"]).some(
        (c) => c.id === existing.id,
      ),
    );
    assert.equal(
      (command?.data?.contacts as Journey["contacts"]).find(
        (c) => c.id === existing.id,
      )?.version,
      7,
    );
    fireEvent.click(ui.getByRole("button", { name: "Edit contacts" }));
    fireEvent.click(ui.getByRole("button", { name: /^Contact$/ }));
    fireEvent.change(ui.getByRole("combobox", { name: "Nama contact" }), {
      target: { value: "Saved vendor" },
    });
    assert.equal(ui.queryByRole("option", { name: /^Saved vendor/ }), null);
    assert.ok(ui.getByText("Kontak ini sudah ditambahkan."));
    assert.equal(
      (ui.getByRole("button", { name: "Simpan contacts" }) as HTMLButtonElement)
        .disabled,
      true,
    );
  } finally {
    cleanup();
  }
});

test("Docs and itinerary start in view and leave edit only after successful save", async () => {
  for (const saved of [false, true]) {
    const doc = {
      id: randomUUID(),
      version: 1,
      title: "Read first",
      date: "2026-10-14",
      creator: user.id,
      category: "SOP",
      body: "## Saved body",
      created_at: "2026-10-14",
      updated_at: "2026-10-14",
    };
    const ui = render(
      <InternalDocs
        s={{
          ...snapshot,
          user: { ...user, privileges: { ...user.privileges, docs: "edit" } },
        }}
        document={doc}
        busy={false}
        navigate={() => {}}
        onDirty={() => {}}
        run={async () => saved}
      />,
    );
    try {
      assert.equal(ui.queryByRole("button", { name: "Simpan dokumen" }), null);
      fireEvent.click(ui.getByRole("button", { name: /^Edit$/ }));
      fireEvent.change(ui.getByRole("textbox", { name: "Judul *" }), {
        target: { value: "Edited title" },
      });
      await act(async () =>
        fireEvent.submit(ui.container.querySelector("form")!),
      );
      assert.equal(
        Boolean(ui.queryByRole("button", { name: "Simpan dokumen" })),
        !saved,
      );
    } finally {
      cleanup();
    }
    const itin = render(
      <Detail
        journey={journey}
        snapshot={snapshot}
        busy={false}
        error=""
        onCommand={async () => saved}
        onEdit={() => {}}
        onNavigate={() => {}}
        onDirty={() => {}}
      />,
    );
    try {
      fireEvent.click(itin.getByRole("button", { name: "Itinerary Draft" }));
      assert.equal(itin.queryByLabelText("Judul Day 1"), null);
      fireEvent.click(itin.getByRole("button", { name: "Edit itinerary" }));
      fireEvent.change(itin.getByLabelText("Judul Day 1"), {
        target: { value: "Updated day" },
      });
      await act(async () =>
        fireEvent.click(itin.getByRole("button", { name: "Simpan itinerary" })),
      );
      assert.equal(Boolean(itin.queryByLabelText("Judul Day 1")), !saved);
    } finally {
      cleanup();
    }
  }
});

test("Docs column menus provide sorting and independent column filters", () => {
  const events: [string, string][] = [];
  const ui = render(
    <InternalDocs
      s={snapshot}
      busy={false}
      run={async () => false}
      navigate={() => {}}
      onDirty={() => {}}
      onFilter={(key, value) => events.push([key, value])}
    />,
  );
  try {
    fireEvent.click(ui.getByRole("button", { name: "Kolom Judul" }));
    fireEvent.click(ui.getByRole("button", { name: "Urut naik ↑" }));
    assert.deepEqual(events, [
      ["sort", "title"],
      ["order", "asc"],
    ]);
    fireEvent.click(ui.getByRole("button", { name: "Kolom Creator" }));
    fireEvent.change(ui.getByRole("textbox", { name: "Filter Creator" }), {
      target: { value: "Alya" },
    });
    assert.deepEqual(events.at(-1), ["creator", "Alya"]);
    fireEvent.keyDown(document, { key: "Escape" });
    assert.equal(ui.queryByRole("dialog"), null);
  } finally {
    cleanup();
  }
});
test("Internal directory shows source column, compact saved contacts and search", () => {
  const ui = render(
    <InternalContacts
      s={{
        ...snapshot,
        user: {
          ...snapshot.user,
          privileges: { ...snapshot.user.privileges, docs: "edit" },
        },
        contactDirectory: [
          {
            ...journey.contacts[0],
            source: "CRM · School trip",
            source_id: journey.id,
            source_kind: "lead",
          },
        ],
      }}
      run={async () => true}
      busy={false}
      onDirty={() => {}}
    />,
  );
  assert.ok(ui.getByRole("columnheader", { name: "Sumber" }));
  assert.equal(ui.queryByRole("button", { name: /Share/ }), null);
  assert.ok(ui.getByText("CRM · School trip"));
  assert.ok(ui.getByRole("button", { name: "Edit contact Original contact" }));
  assert.equal(ui.queryByRole("textbox", { name: "Nama contact" }), null);
  fireEvent.change(ui.getByRole("textbox", { name: "Cari contacts" }), {
    target: { value: "no matching contact" },
  });
  assert.equal(ui.queryByText("Original contact"), null);
  cleanup();
});
test("saved CRM contacts start as a compact table", () => {
  const ui = render(
    <Detail
      journey={journey}
      snapshot={snapshot}
      busy={false}
      error=""
      onCommand={async () => true}
      onEdit={() => {}}
      onNavigate={() => {}}
      onDirty={() => {}}
    />,
  );
  fireEvent.click(ui.getByRole("button", { name: "Contacts" }));
  assert.equal(ui.queryByRole("textbox", { name: "Nama contact" }), null);
  assert.ok(ui.getByRole("button", { name: "Edit contacts" }));
  cleanup();
});
test("shared Trip uses member tabs with per-tab edit rights and compact public contact notes", async () => {
  const trip = {
    ...journey,
    kind: "trip" as const,
    stage: "Planned",
    contacts: [
      {
        id: randomUUID(),
        name: "Guest guide",
        phone: "123",
        email: "guide@example.test",
        note: "Public contact note",
        role: "",
        organization: "",
      },
    ],
  };
  const s: Snapshot = {
    ...snapshot,
    journeys: [trip],
    user: {
      ...snapshot.user,
      id: "shared-viewer",
      privileges: { sales: "none", trips: "view", finance: "none" },
    },
    tasks: [],
  };
  const permissions = {
    overview: "view",
    tasks: "none",
    notes: "view",
    itinerary: "edit",
    contacts: "view",
    finance: "view",
  } as const;
  const ui = render(
    <Detail
      journey={trip}
      snapshot={s}
      busy={false}
      error=""
      onCommand={async () => false}
      onEdit={() => {}}
      onNavigate={() => {}}
      onDirty={() => {}}
      shared={{ permissions, finance: <p>Link submissions only</p> }}
    />,
  );
  assert.equal(ui.queryByRole("button", { name: "Share" }), null);
  assert.equal(ui.queryByRole("button", { name: "Tasks" }), null);
  assert.equal(ui.queryByText("Quoted total · IDR"), null);
  fireEvent.click(ui.getByRole("button", { name: "Contacts" }));
  assert.ok(ui.getByRole("columnheader", { name: "Nama" }));
  assert.ok(ui.getByRole("columnheader", { name: "Telepon / Email" }));
  assert.ok(ui.getByText("Public contact note"));
  assert.equal(ui.queryByRole("button", { name: "Simpan contacts" }), null);
  fireEvent.click(ui.getByRole("button", { name: "Notes" }));
  assert.equal(ui.queryByRole("button", { name: /Simpan/ }), null);
  fireEvent.click(ui.getByRole("button", { name: "Itinerary" }));
  fireEvent.click(ui.getByRole("button", { name: "Edit itinerary" }));
  assert.ok(ui.getByRole("button", { name: "Simpan itinerary" }));
  assert.equal(ui.queryByText("Itinerary template"), null);
  fireEvent.click(ui.getByRole("button", { name: "Finance" }));
  assert.ok(ui.getByText("Link submissions only"));
  assert.equal(ui.queryByText("Kas Trip · satu ledger"), null);
  cleanup();
});
test("shared Trip Public task viewer cannot change task status", () => {
  const trip = { ...journey, kind: "trip" as const };
  const t = {
    id: randomUUID(),
    version: 1,
    created_at: "",
    updated_at: "",
    title: "Public task",
    description: "",
    assignee: "public",
    parent: trip.id,
    context: "trip" as const,
    status: "Assigned" as const,
    due: "",
    completed_at: null,
    cancelled_at: null,
    created_by: "public",
  };
  const s: Snapshot = {
    ...snapshot,
    journeys: [trip],
    tasks: [t],
    user: {
      ...snapshot.user,
      id: "shared-viewer",
      privileges: { sales: "none", trips: "view", finance: "none" },
    },
  };
  const ui = render(
    <Detail
      journey={trip}
      snapshot={s}
      busy={false}
      error=""
      onCommand={async () => false}
      onEdit={() => {}}
      onNavigate={() => {}}
      onDirty={() => {}}
      shared={{
        permissions: {
          overview: "none",
          tasks: "view",
          notes: "none",
          itinerary: "none",
          contacts: "none",
          finance: "none",
        },
        finance: null,
      }}
    />,
  );
  assert.ok(ui.getByText("Public task"));
  assert.equal(
    (ui.getByLabelText("Status Public task") as HTMLSelectElement).disabled,
    true,
  );
  assert.equal(ui.queryByRole("button", { name: "Tambah task" }), null);
  cleanup();
});
test("trip templates stay in their own tabs and the redundant context panel is absent", () => {
  const trip = { ...journey, kind: "trip" as const, stage: "Planned" };
  const s: Snapshot = {
    ...snapshot,
    journeys: [trip],
    templates: [
      {
        id: randomUUID(),
        name: "Note example",
        kind: "trip_note",
        content: "## Note",
        active: true,
        version: 1,
      },
      {
        id: randomUUID(),
        name: "Day example",
        kind: "itinerary",
        content: [{ title: "Day", items: [] }],
        active: true,
        version: 1,
      },
    ],
  };
  const ui = render(
    <Detail
      journey={trip}
      snapshot={s}
      busy={false}
      error=""
      onCommand={async () => false}
      onEdit={() => {}}
      onNavigate={() => {}}
      onDirty={() => {}}
    />,
  );
  try {
    assert.equal(ui.queryByText("Trip context"), null);
    assert.equal(ui.queryByLabelText("Template"), null);
    fireEvent.click(ui.getByRole("button", { name: "Notes" }));
    assert.ok(ui.getByText("Note template"));
    assert.deepEqual(
      Array.from(
        (ui.getByLabelText("Template") as HTMLSelectElement).options,
      ).map((x) => x.text),
      ["Pilih template…", "Note example"],
    );
    fireEvent.click(ui.getByRole("button", { name: "Itinerary" }));
    assert.ok(ui.getByText("Itinerary template"));
    assert.deepEqual(
      Array.from(
        (ui.getByLabelText("Template") as HTMLSelectElement).options,
      ).map((x) => x.text),
      ["Pilih template…", "Day example"],
    );
  } finally {
    cleanup();
  }
});
test("whole-card open actions work and status controls stay independent", () => {
  const id = randomUUID();
  let navigated = "",
    commands = 0;
  const ui = render(
    <Board
      columns={["Drafts", "Contacted", "Prospect"]}
      s={{ ...snapshot, journeys: [{ ...journey, id }] }}
      mode="journeys"
      onCommand={async () => {
        commands++;
        return true;
      }}
      onEdit={() => {}}
      onNavigate={(url) => {
        navigated = url;
      }}
      onAdd={() => {}}
    />,
  );
  try {
    fireEvent.click(ui.getByRole("button", { name: "Buka School trip" }));
    assert.equal(navigated, "/sales/" + id);
    navigated = "";
    fireEvent.change(ui.getByLabelText("Stage School trip"), {
      target: { value: "Contacted" },
    });
    assert.equal(commands, 1);
    assert.equal(navigated, "");
  } finally {
    cleanup();
  }
});
test("money input autoformats displayed digits and submits exact decimal strings", () => {
  const ui = render(<MoneyInput name="amount" label="Amount IDR" required />);
  try {
    const input = ui.getByLabelText("Amount IDR") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1250000,50" } });
    assert.equal(input.value, "1.250.000,50");
    assert.equal(
      (ui.container.querySelector('input[name="amount"]') as HTMLInputElement)
        .value,
      "1250000.5",
    );
    fireEvent.change(input, { target: { value: "9007199254740993,51" } });
    assert.equal(
      (ui.container.querySelector('input[name="amount"]') as HTMLInputElement)
        .value,
      "9007199254740993.51",
    );
  } finally {
    cleanup();
  }
});
test("ledger uses signed amounts and keeps void controls admin-only", () => {
  const t = {
    id: randomUUID(),
    title: "Hotel deposit",
    description: "Reservation",
    direction: "out",
    amount: "1250000.5",
    category: "out-1",
    date: "2026-10-14",
    status: "posted",
    trip: null,
    created_by: user.id,
  } as Transaction;
  const member = {
    ...snapshot,
    user: {
      ...user,
      role: "member" as const,
      privileges: { ...user.privileges, finance: "edit" as const },
    },
    transactions: [t],
  };
  const ui = render(<Ledger s={member} canEdit onEdit={() => {}} />);
  try {
    assert.ok(ui.getByText("−Rp 1.250.000,50"));
    assert.equal(ui.queryByText("Reservation"), null);
    fireEvent.click(
      ui
        .getByRole("row", { name: "Buka transaksi Hotel deposit" })
        .querySelector("td")!,
    );
    assert.ok(ui.getByRole("dialog"));
    assert.ok(ui.getByText("Reservation"));
    assert.ok(ui.getByRole("button", { name: "Ajukan koreksi" }));
    assert.equal(ui.queryByRole("button", { name: "Void" }), null);
    assert.ok(ui.getByRole("heading", { name: "Hotel deposit" }));
  } finally {
    cleanup();
  }
});
test("Internal Docs table opens documents and view privilege cannot edit or share", () => {
  const doc = {
    id: randomUUID(),
    version: 1,
    title: "SOP",
    date: "2026-10-14",
    creator: user.id,
    category: "Policy",
    body: "## Instructions",
    created_at: "2026-10-14",
    updated_at: "2026-10-14",
  };
  const reader = {
    ...snapshot,
    user: {
      ...user,
      role: "member" as const,
      privileges: { ...user.privileges, docs: "view" as const },
    },
    documents: [doc],
  };
  let destination = "";
  const ui = render(
    <InternalDocs
      s={reader}
      run={async () => false}
      busy={false}
      navigate={(url) => {
        destination = url;
      }}
      onDirty={() => {}}
    />,
  );
  try {
    assert.deepEqual(
      ui
        .getAllByRole("columnheader")
        .map((el) => el.querySelector("button")?.getAttribute("aria-label"))
        .filter(Boolean),
      ["Kolom Judul", "Kolom Date", "Kolom Creator", "Kolom Category"],
    );
    fireEvent.click(ui.getByRole("button", { name: "SOP" }));
    assert.equal(destination, "/docs/" + doc.id);
    destination = "";
    fireEvent.click(
      ui
        .getByRole("row", { name: "Buka dokumen SOP" })
        .querySelectorAll("td")[2],
    );
    assert.equal(destination, "/docs/" + doc.id);
    destination = "";
    fireEvent.keyDown(ui.getByRole("row", { name: "Buka dokumen SOP" }), {
      key: "Enter",
    });
    assert.equal(destination, "/docs/" + doc.id);
    assert.equal(ui.queryByRole("button", { name: /Dokumen baru/ }), null);
    ui.rerender(
      <InternalDocs
        s={reader}
        document={doc}
        run={async () => false}
        busy={false}
        navigate={() => {}}
        onDirty={() => {}}
      />,
    );
    assert.ok(ui.getByRole("heading", { name: "Instructions" }));
    assert.equal(ui.queryByRole("button", { name: "Simpan dokumen" }), null);
    assert.equal(ui.queryByRole("button", { name: /Share/ }), null);
  } finally {
    cleanup();
  }
});
const user: Person = {
  id: randomUUID(),
  version: 1,
  name: "Admin Test",
  email: "admin@example.test",
  role: "admin",
  status: "active",
  privileges: { sales: "edit", trips: "edit", finance: "edit" },
};
const journey: Journey = {
  id: randomUUID(),
  version: 1,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  kind: "lead",
  name: "School trip",
  client: "Synthetic school",
  pic: user.id,
  people: [user.id],
  stage: "Drafts",
  lifecycle: "active",
  trip_type: "Educational",
  client_type: "School",
  start: "",
  end: "",
  guests: 30,
  quote: "",
  notes: [{ id: randomUUID(), title: "Lead Notes", body: "Original note" }],
  contacts: [
    {
      id: randomUUID(),
      name: "Original contact",
      role: "PIC",
      organization: "School",
      phone: "",
      email: "",
      note: "",
    },
  ],
  days: [{ id: randomUUID(), title: "", items: [] }],
  source_lead: null,
  converted_trip: null,
  archived_at: null,
  lost_reason: "",
};
const snapshot: Snapshot = {
  user,
  people: [user],
  invitations: [],
  journeys: [journey],
  tasks: [],
  transactions: [],
  categories: [],
  timezone: "Asia/Jakarta",
  today: "2026-10-14",
  demo: false,
  totals: { moneyIn: "0", moneyOut: "0", net: "0" },
  cashRows: [],
  count: 0,
  taskCounts: {},
  reassignment: [],
};
test("Sales tab switching protects unsaved notes and saves them explicitly", async () => {
  let command: Command | undefined;
  let isDirty = false;
  const originalConfirm = globalThis.confirm;
  globalThis.confirm = () => false;
  const ui = render(
    <Detail
      journey={journey}
      snapshot={snapshot}
      busy={false}
      error=""
      onCommand={async (c) => {
        command = c;
        return false;
      }}
      onEdit={() => {}}
      onNavigate={() => {}}
      onDirty={(v) => {
        isDirty = v;
      }}
    />,
  );
  try {
    fireEvent.click(ui.getByRole("button", { name: "Notes" }));
    const noteEditor = await ui.findByRole(
      "textbox",
      { name: "Markdown note" },
      { timeout: 10000 },
    );
    await act(async () => {
      noteEditor.innerHTML = "<p>Unsaved new note</p>";
      fireEvent.input(noteEditor);
    });
    await waitFor(() => assert.equal(isDirty, true));
    fireEvent.click(ui.getByRole("button", { name: "Contacts" }));
    assert.ok(ui.getByRole("textbox", { name: "Markdown note" }));
    assert.equal(ui.queryByRole("button", { name: "Simpan contacts" }), null);
    fireEvent.click(ui.getByRole("button", { name: "Simpan notes" }));
    await waitFor(() => assert.ok(command));
    assert.equal(command!.action, "content");
    assert.equal(
      (command!.data!.notes as Journey["notes"])[0].body,
      "Unsaved new note",
    );
    assert.equal(isDirty, true);
  } finally {
    cleanup();
    globalThis.confirm = originalConfirm;
  }
});
test("Trips user without Finance sees no Finance tab or cash data controls", () => {
  const person: Person = {
    ...user,
    role: "member",
    privileges: { sales: "none", trips: "view", finance: "none" },
  };
  const trip: Journey = {
    ...journey,
    kind: "trip",
    stage: "Planned",
    start: "2026-10-20",
    end: "2026-10-22",
  };
  const ui = render(
    <Detail
      journey={trip}
      snapshot={{
        ...snapshot,
        user: person,
        people: [person],
        journeys: [trip],
      }}
      busy={false}
      error=""
      onCommand={async () => false}
      onEdit={() => {}}
      onNavigate={() => {}}
      onDirty={() => {}}
    />,
  );
  try {
    assert.equal(ui.queryByRole("button", { name: "Finance" }), null);
    assert.equal(ui.queryByRole("button", { name: "Money In" }), null);
    assert.equal(ui.queryByRole("button", { name: "Edit detail" }), null);
  } finally {
    cleanup();
  }
});
test("cash filter responses cannot overwrite a newer period", async () => {
  const original = globalThis.fetch;
  const pending: ((r: Response) => void)[] = [];
  globalThis.fetch = async (input) => {
    if (
      new URL(String(input), "http://127.0.0.1:3000").searchParams.has(
        "budget_trip",
      )
    )
      return new Response(JSON.stringify({ budgets: [] }), { status: 200 });
    return new Promise<Response>((resolve) => pending.push(resolve));
  };
  const trip: Journey = {
    ...journey,
    kind: "trip",
    stage: "Planned",
    start: "2026-10-20",
    end: "2026-10-22",
  };
  const ui = render(
    <Detail
      journey={trip}
      snapshot={{ ...snapshot, journeys: [trip] }}
      busy={false}
      error=""
      onCommand={async () => false}
      onEdit={() => {}}
      onNavigate={() => {}}
      onDirty={() => {}}
    />,
  );
  try {
    fireEvent.click(ui.getByRole("button", { name: "Finance" }));
    await waitFor(() => assert.equal(pending.length, 1));
    fireEvent.change(ui.getByLabelText("Dari", { exact: true }), {
      target: { value: "2026-10-01" },
    });
    await waitFor(() => assert.equal(pending.length, 2));
    const response = (amount: string) =>
      new Response(
        JSON.stringify({
          ...snapshot,
          journeys: [trip],
          totals: { moneyIn: amount, moneyOut: "0", net: amount },
        }),
        { status: 200 },
      );
    await act(async () => {
      pending[1](response("200000"));
    });
    await waitFor(() => assert.ok(ui.getAllByText("Rp 200.000").length));
    await act(async () => {
      pending[0](response("10000000"));
    });
    assert.equal(ui.queryByText("Rp 10.000.000"), null);
    assert.ok(ui.getAllByText("Rp 200.000").length);
  } finally {
    cleanup();
    globalThis.fetch = original;
  }
});
test("protected Markdown rendering blocks script markup and executable links", () => {
  const dangerous: Journey = {
    ...journey,
    notes: [
      {
        id: randomUUID(),
        title: "Unsafe test",
        body: "<script>alert(1)</script>\n\n[Bad link](javascript:alert%281%29)\n\n[Safe](https://example.test)",
      },
    ],
  };
  const ui = render(
    <Detail
      journey={dangerous}
      snapshot={snapshot}
      busy={false}
      error=""
      onCommand={async () => false}
      onEdit={() => {}}
      onNavigate={() => {}}
      onDirty={() => {}}
    />,
  );
  try {
    fireEvent.click(ui.getByRole("button", { name: "Notes" }));
    assert.ok(ui.getByRole("alert"));
    assert.equal(ui.container.querySelector("script"), null);
    assert.equal(ui.container.querySelector('a[href^="javascript:"]'), null);
    assert.equal(
      ui.getByRole("link", { name: "Safe" }).getAttribute("rel"),
      "noopener noreferrer",
    );
  } finally {
    cleanup();
  }
});
test("table row button works on notes with cell line breaks and respects disabled state", async () => {
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
    dom.window,
  );
  let saved = "";
  const value = "| Nama | Harga |\n| --- | --- |\n| Satu<br>Dua | 20 |";
  const { unsupportedMarkdown } = await import("../src/lib/editor-content");
  const { Markdown } = await import("../src/components/markdown");
  const ui = render(
    <RichEditorClient
      value={value}
      label="Table note"
      onChange={(v) => {
        saved = v;
      }}
    />,
  );
  try {
    const field = await ui.findByRole("textbox", { name: "Table note" });
    const count = field.querySelectorAll("tr").length;
    fireEvent.click(ui.getByRole("button", { name: "Tambah baris tabel" }));
    assert.equal(field.querySelectorAll("tr").length, count + 1);
    assert.equal(unsupportedMarkdown(saved), false);
    ui.rerender(
      <RichEditorClient
        value={saved}
        label="Table note"
        onChange={() => {}}
        disabled
      />,
    );
    assert.equal(
      (
        ui.getByRole("button", {
          name: "Tambah baris tabel",
        }) as HTMLButtonElement
      ).disabled,
      true,
    );
    ui.rerender(<Markdown body={value} />);
    assert.equal(ui.container.querySelector("td")?.innerHTML, "Satu<br>\nDua");
  } finally {
    cleanup();
    globalThis.requestAnimationFrame = raf;
  }
});

test("WYSIWYG replaces external template content without dirty events and disables editing during save", async () => {
  let changes = 0;
  const onChange = () => changes++;
  const ui = render(
    <RichEditorClient
      value={"## Initial\n\n**Bold**"}
      label="Template test"
      onChange={onChange}
    />,
  );
  try {
    const field = await ui.findByRole("textbox", { name: "Template test" });
    assert.equal(field.querySelector("h2")?.textContent, "Initial");
    assert.equal(field.querySelector("strong")?.textContent, "Bold");
    assert.equal(ui.queryByRole("button", { name: "Preview" }), null);
    ui.rerender(
      <RichEditorClient
        value={"### Replaced\n\n- New item"}
        label="Template test"
        onChange={onChange}
        disabled
      />,
    );
    await waitFor(() =>
      assert.equal(field.querySelector("h3")?.textContent, "Replaced"),
    );
    assert.equal(field.querySelector("li")?.textContent, "New item");
    assert.equal(field.getAttribute("contenteditable"), "false");
    assert.equal(
      (ui.getByRole("button", { name: "Bold" }) as HTMLButtonElement).disabled,
      true,
    );
    assert.equal(changes, 0);
  } finally {
    cleanup();
  }
});
test("budget viewer sees exact IDR plans and actuals without edit controls", async () => {
  const original = globalThis.fetch;
  const tripId = randomUUID();
  const viewer: Snapshot = {
    ...snapshot,
    user: {
      ...user,
      role: "member",
      privileges: { sales: "none", trips: "none", finance: "view" },
    },
    journeys: [{ ...journey, id: tripId, kind: "trip" }],
  };
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        budgets: [
          {
            trip: tripId,
            name: "Trip test",
            category: "cost",
            label: "Transport",
            direction: "out",
            active: true,
            lifecycle: "active",
            budget: "9007199254740993",
            actual: "1",
            version: 1,
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  const ui = render(
    <Budget
      s={viewer}
      tripId={tripId}
      busy={false}
      run={async () => {
        throw Error("view-only must not write");
      }}
    />,
  );
  try {
    await waitFor(() => assert.ok(ui.getByText("Transport")));
    assert.ok(ui.getAllByText("Rp 9.007.199.254.740.993").length);
    assert.ok(ui.getByText("Rp 9.007.199.254.740.992"));
    assert.equal(ui.queryByRole("button", { name: "Simpan" }), null);
    assert.equal(ui.queryByLabelText("Budget Transport"), null);
  } finally {
    cleanup();
    globalThis.fetch = original;
  }
});
test("audit diffs show only changed fields and safely escape values", () => {
  const ui = render(
    <AuditDiff
      metadata={{
        before: { amount: "100", category: "cost" },
        after: { amount: "200", category: "cost" },
        reason: "<script>test</script>",
      }}
    />,
  );
  try {
    assert.ok(ui.getByText("1 field berubah"));
    assert.ok(ui.getByText("100"));
    assert.ok(ui.getByText("200"));
    assert.equal(ui.queryByText("category"), null);
    assert.equal(ui.container.querySelector("script"), null);
  } finally {
    cleanup();
  }
});
test("refreshing one budget category preserves an unsaved sibling draft", async () => {
  const original = globalThis.fetch,
    tripId = randomUUID();
  let version = 1;
  const rows = () =>
    ["Transport", "Hotel"].map((label, index) => ({
      trip: tripId,
      name: "Trip",
      category: label,
      label,
      direction: "out",
      active: true,
      lifecycle: "active",
      budget: "100",
      actual: "0",
      version: index === 0 ? version : 1,
    }));
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ budgets: rows() }), { status: 200 });
  const state = {
    ...snapshot,
    journeys: [{ ...journey, id: tripId, kind: "trip" as const }],
  };
  const ui = render(
    <Budget s={state} tripId={tripId} busy={false} run={async () => true} />,
  );
  try {
    const hotel = await ui.findByLabelText("Budget Hotel");
    fireEvent.change(hotel, { target: { value: "900" } });
    version = 2;
    ui.rerender(
      <Budget
        s={{ ...state }}
        tripId={tripId}
        busy={false}
        run={async () => true}
      />,
    );
    await waitFor(() => assert.equal(ui.queryByRole("status") === null, true));
    assert.equal(
      (ui.getByLabelText("Budget Hotel") as HTMLInputElement).value,
      "900",
    );
  } finally {
    cleanup();
    globalThis.fetch = original;
  }
});

test("sales notes are isolated and itinerary descriptions use plain text", async () => {
  const lead = {
    ...journey,
    days: [
      {
        id: randomUUID(),
        title: "Day",
        date: "2026-10-22",
        items: [
          {
            id: randomUUID(),
            name: "Museum",
            description: "See https://example.com",
          },
        ],
      },
    ],
  };
  const ui = render(
    <Detail
      snapshot={snapshot}
      journey={lead}
      onCommand={async () => true}
      onEdit={() => {}}
      onNavigate={() => {}}
      busy={false}
      error=""
      onDirty={() => {}}
    />,
  );
  try {
    assert.equal(ui.queryByLabelText("Judul note"), null);
    fireEvent.click(ui.getByRole("button", { name: "Notes" }));
    assert.ok(ui.getByLabelText("Judul note"));
    assert.ok(ui.container.querySelector(".panel > .template-picker"));
    fireEvent.click(ui.getByRole("button", { name: "Itinerary Draft" }));
    assert.equal(ui.queryByLabelText("Activity description"), null);
    fireEvent.click(ui.getByRole("button", { name: "Edit itinerary" }));
    assert.equal(ui.getByLabelText("Activity description").tagName, "TEXTAREA");
    assert.equal(
      ui.container.querySelector(".itinerary-row .rich-editor"),
      null,
    );
    assert.equal(
      (ui.getByLabelText("Activity description") as HTMLTextAreaElement).value,
      "See https://example.com",
    );
  } finally {
    cleanup();
  }
});

test("transaction history includes original values and actual changed fields", async () => {
  const { TransactionHistory, initialTransaction } =
    await import("../src/components/transaction-history");
  const originalFetch = globalThis.fetch;
  const t = {
    id: randomUUID(),
    version: 2,
    created_at: "2026-10-14T09:00:00Z",
    title: "Deposit",
    description: "New note",
    amount: "100.50",
    date: "2026-10-14",
    direction: "in",
    status: "posted",
    category: "in-1",
    reason: "Correct note",
    created_by: user.id,
  } as Transaction;
  const before = { ...t, description: "Original note" };
  const events = [
    {
      id: randomUUID(),
      actor: user.id,
      entity: t.id,
      at: "2026-10-14T10:00:00Z",
      action: "approve_correction",
      metadata: { before, after: t, reason: "Correct note" },
    },
    {
      id: randomUUID(),
      actor: user.id,
      entity: t.id,
      at: t.created_at,
      action: "create_transaction",
      metadata: {},
    },
  ];
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ audit: events, count: 2 }), { status: 200 });
  const ui = render(<TransactionHistory transaction={t} snapshot={snapshot} />);
  try {
    await waitFor(() => assert.ok(ui.getByText("Pencatatan awal")));
    assert.ok(ui.getByText("Record awal"));
    assert.ok(ui.getByText("Correct note"));
    assert.ok(ui.getByText("Koreksi dikonfirmasi"));
    assert.equal(initialTransaction(events, t)?.description, "Original note");
    assert.equal(initialTransaction([], t), undefined);
    const changed = ui.container.querySelector(
      "tbody tr:last-child details summary",
    )!;
    assert.equal(changed.textContent, "Catatan");
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
  }
});
