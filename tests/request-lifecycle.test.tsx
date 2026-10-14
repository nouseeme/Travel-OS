import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { Snapshot } from "../src/lib/model";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://127.0.0.1:3000",
  pretendToBeVisual: true,
});
for (const name of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
  "MutationObserver",
] as const)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value:
      name === "window"
        ? dom.window
        : name === "document"
          ? dom.window.document
          : name === "navigator"
            ? dom.window.navigator
            : dom.window[name],
  });
Object.defineProperty(globalThis, "getComputedStyle", {
  configurable: true,
  value: dom.window.getComputedStyle.bind(dom.window),
});
const { render, fireEvent, cleanup, waitFor, act } =
  await import("@testing-library/react");
const { Dashboard } = await import("../src/components/dashboard");
const { SharedTrip } = await import("../src/components/shared-trip");
const { AppRouterContext } =
  await import("next/dist/shared/lib/app-router-context.shared-runtime");
const { PathnameContext } =
  await import("next/dist/shared/lib/hooks-client-context.shared-runtime");

const snapshot: Snapshot = {
  user: {
    id: "member",
    name: "Current user",
    email: "test@example.test",
    role: "member",
    status: "active",
    version: 1,
    privileges: { sales: "view", trips: "view", finance: "none" },
  },
  people: [],
  invitations: [],
  journeys: [],
  tasks: [],
  transactions: [],
  categories: [],
  timezone: "UTC",
  today: "2026-10-14",
  demo: false,
  totals: { moneyIn: "0", moneyOut: "0", net: "0" },
  cashRows: [],
  count: 0,
  taskCounts: {},
  reassignment: [],
};
test("dashboard cancels superseded reads, ignores late data, pauses hidden refresh and purges revoked access", async () => {
  const original = globalThis.fetch;
  const pending: {
    signal: AbortSignal;
    resolve: (response: Response) => void;
  }[] = [];
  const replaced: string[] = [];
  globalThis.fetch = async (_url, options) =>
    new Promise<Response>((resolve) =>
      pending.push({ signal: options!.signal!, resolve }),
    );
  const router = {
    back() {},
    forward() {},
    refresh() {},
    push() {},
    prefetch() {},
    replace(url: string) {
      replaced.push(url);
    },
    bfcacheId: "test",
  };
  const ui = render(
    <AppRouterContext.Provider value={router}>
      <PathnameContext.Provider value="/home">
        <Dashboard />
      </PathnameContext.Provider>
    </AppRouterContext.Provider>,
  );
  try {
    assert.equal(pending.length, 1);
    fireEvent.click(ui.getByRole("button", { name: "Reload" }));
    assert.equal(pending[0].signal.aborted, true);
    assert.equal(pending.length, 2);
    await act(async () => pending[1].resolve(Response.json(snapshot)));
    await waitFor(() => assert.ok(ui.getByText("Current user")));
    await act(async () =>
      pending[0].resolve(
        Response.json({
          ...snapshot,
          user: { ...snapshot.user, name: "Stale user" },
        }),
      ),
    );
    assert.equal(ui.queryByText("Stale user"), null);
    fireEvent.focus(window);
    fireEvent.focus(window);
    assert.equal(pending.length, 3, "focus events must not overlap reads");
    await act(async () => pending[2].resolve(Response.json(snapshot)));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    fireEvent.focus(window);
    assert.equal(pending.length, 3, "hidden tabs must not poll");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    fireEvent.focus(window);
    await act(async () =>
      pending[3].resolve(
        Response.json({ error: "Session expired" }, { status: 401 }),
      ),
    );
    await waitFor(() => assert.deepEqual(replaced, ["/login"]));
    assert.equal(ui.queryByText("Current user"), null);
    fireEvent.click(ui.getByRole("button", { name: "Reload" }));
    ui.unmount();
    assert.equal(pending.at(-1)!.signal.aborted, true);
  } finally {
    cleanup();
    globalThis.fetch = original;
  }
});

test("shared Trip refresh deduplicates focus, cancels old tokens and aborts on unmount", () => {
  const original = globalThis.fetch;
  const signals: AbortSignal[] = [];
  globalThis.fetch = async (_url, options) => {
    signals.push(options!.signal!);
    return new Promise<Response>(() => {});
  };
  const ui = render(<SharedTrip token={"a".repeat(64)} />);
  try {
    fireEvent.focus(window);
    fireEvent.focus(window);
    assert.equal(signals.length, 1);
    ui.rerender(<SharedTrip token={"b".repeat(64)} />);
    assert.equal(signals[0].aborted, true);
    assert.equal(signals.length, 2);
    ui.unmount();
    assert.equal(signals[1].aborted, true);
  } finally {
    cleanup();
    globalThis.fetch = original;
  }
});
