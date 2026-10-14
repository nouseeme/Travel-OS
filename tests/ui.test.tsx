import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { randomUUID } from "node:crypto";
import type {
  Journey,
  Snapshot,
  Person,
  Command,
  Contact,
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
const { render, fireEvent, cleanup, waitFor, act } =
  await import("@testing-library/react");
const { Detail } = await import("../src/components/detail");
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
test("saving contacts preserves unsaved notes in the same atomic command", async () => {
  let command: Command | undefined;
  let isDirty = false;
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
    fireEvent.change(ui.getByLabelText("Markdown note"), {
      target: { value: "Unsaved new note" },
    });
    fireEvent.change(ui.getByLabelText("Nama *", { exact: true }), {
      target: { value: "Unsaved new contact" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Simpan contacts" }));
    await waitFor(() => assert.ok(command));
    assert.equal(command!.action, "content");
    assert.equal(
      (command!.data!.notes as Journey["notes"])[0].body,
      "Unsaved new note",
    );
    assert.equal(
      (command!.data!.contacts as Contact[])[0].name,
      "Unsaved new contact",
    );
    assert.equal(
      (ui.getByLabelText("Markdown note") as HTMLTextAreaElement).value,
      "Unsaved new note",
    );
    assert.equal(isDirty, true);
  } finally {
    cleanup();
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
  globalThis.fetch = async () =>
    new Promise<Response>((resolve) => pending.push(resolve));
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
test("Markdown preview blocks script markup and executable links", () => {
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
    fireEvent.click(ui.getByRole("button", { name: "Preview" }));
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
