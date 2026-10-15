import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { Snapshot, Command } from "../src/lib/model";

const dom = new JSDOM("<html><body></body></html>", {
  url: "http://localhost",
});
for (const [name, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
}))
  Object.defineProperty(globalThis, name, { configurable: true, value });
const { render, fireEvent, cleanup, act } =
  await import("@testing-library/react");
const { Configuration } = await import("../src/components/p1");
const s: Snapshot = {
  user: {
    id: "admin",
    version: 1,
    name: "Admin",
    email: "admin@example.test",
    status: "active",
    role: "admin",
    privileges: { sales: "edit", trips: "edit", finance: "edit", docs: "edit" },
  },
  helpSettings: { public: true, version: 3 },
  people: [],
  invitations: [],
  journeys: [],
  tasks: [],
  transactions: [],
  categories: [],
  timezone: "Asia/Jakarta",
  today: "2026-10-15",
  demo: false,
  totals: { moneyIn: "0", moneyOut: "0", net: "0" },
  cashRows: [],
  count: 0,
  taskCounts: {},
  reassignment: [],
};

test("help toggle preserves saved access after failure and reflects server-confirmed Secret access", async () => {
  let command: Command | undefined;
  const run = async (c: Command) => {
    command = c;
    return false;
  };
  const ui = render(<Configuration s={s} busy={false} run={run} />);
  try {
    fireEvent.click(ui.getByRole("button", { name: "Halaman bantuan" }));
    const toggle = ui.getByRole("switch") as HTMLInputElement;
    assert.equal(toggle.checked, true);
    await act(async () => fireEvent.click(toggle));
    assert.deepEqual(command, {
      action: "save_help_access",
      version: 3,
      data: { public: false },
    });
    assert.equal(
      toggle.checked,
      true,
      "Failed save must not claim the help page became private",
    );
    ui.rerender(
      <Configuration
        s={{ ...s, helpSettings: { public: false, version: 4 } }}
        busy={false}
        run={run}
      />,
    );
    assert.equal(toggle.checked, false);
    assert.ok(ui.getByText(/Secret — hanya anggota aktif/));
    ui.rerender(<Configuration s={s} busy run={run} />);
    assert.equal(toggle.disabled, true);
  } finally {
    cleanup();
  }
});
