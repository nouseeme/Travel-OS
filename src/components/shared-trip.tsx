"use client";
import { SelectionTable } from "./selection-table";
import { useState, useEffect, useRef, useCallback } from "react";
import type { Snapshot, Command } from "@/lib/model";
import type { SharedTripData } from "@/lib/trip-sharing";
import type { Editor } from "./forms";
import { Detail } from "./detail";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { Toast } from "./toast";
import { CompanyIdentity } from "./brand";
import { PlatformFooter } from "./platform-credit";
import { MoneyInput } from "./money-input";
import { dateInZone, localTimezone } from "@/lib/time";
import { moneyLabel, shortDate } from "@/lib/format";
export function SharedTrip({ token }: { token: string }) {
  const [data, setData] = useState<SharedTripData | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [dirty, setDirty] = useState(false),
    [editor, setEditor] = useState<Editor | null>(null);
  const sequence = useRef(0),
    activeRequest = useRef<AbortController | null>(null),
    sending = useRef(false),
    hasData = useRef(false),
    key = useRef("");
  const load = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const seq = ++sequence.current;
    setLoading(true);
    try {
      const res = await fetch("/api/shared-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        cache: "no-store",
        signal: controller.signal,
      });
      const d = await res.json();
      if (seq !== sequence.current) return;
      if (!res.ok) {
        if ([401, 403, 404].includes(res.status)) {
          setData(null);
          setEditor(null);
          setDirty(false);
          hasData.current = false;
        }
        throw Error(d.error);
      }
      setData(d);
      hasData.current = true;
      setError("");
    } catch (e) {
      if (!controller.signal.aborted && seq === sequence.current)
        setError((e as Error).message);
    } finally {
      if (seq === sequence.current) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }, [token]);
  useEffect(() => {
    void load();
    return () => {
      sequence.current++;
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [load]);
  useEffect(() => {
    const refresh = () => {
      if (
        document.visibilityState === "visible" &&
        !activeRequest.current &&
        !dirty &&
        !editor &&
        !sending.current
      )
        void load();
    };
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [dirty, editor, load]);
  useEffect(() => {
    if (!dirty && !editor) return;
    const guard = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, editor]);
  async function run(c: Command) {
    if (sending.current) return false;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shared-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          command: { ...c, timezone: localTimezone() },
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        if ([401, 403, 404].includes(res.status)) {
          setData(null);
          hasData.current = false;
          setEditor(null);
          setDirty(false);
        }
        throw Error(d.error);
      }
      setNotice(
        c.action === "submit_transaction"
          ? "Pengajuan tersimpan. Menunggu approval member."
          : "Perubahan tersimpan.",
      );
      setEditor(null);
      setDirty(false);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  function open(e: Editor) {
    if (dirty && !confirm("Ada perubahan belum disimpan. Buka editor?")) return;
    key.current = crypto.randomUUID();
    setEditor(e);
  }
  if (!data)
    return (
      <div className="auth-page">
        <CompanyIdentity logoOnly />
        <h1>{loading ? "Memuat Trip…" : "Link tidak tersedia"}</h1>
        {error && <p role="alert">{error}</p>}
        <PlatformFooter />
      </div>
    );
  const j = data.journey;
  const snapshot: Snapshot = {
    user: {
      id: "shared-viewer",
      name: "Public",
      email: "",
      version: 1,
      role: "member",
      status: "active",
      privileges: {
        sales: "none",
        trips: "view",
        finance: "none",
        docs: "none",
      },
    },
    people: [],
    invitations: [],
    journeys: [j],
    tasks: data.tasks,
    transactions: [],
    categories: data.categories,
    timezone: localTimezone(),
    today: dateInZone(),
    demo: false,
    totals: { moneyIn: "0", moneyOut: "0", net: "0" },
    cashRows: [],
    count: 0,
    taskCounts: {},
    reassignment: [],
  };
  const finance = (
    <section className="panel spaced-panel">
      <div className="panel-heading">
        <div>
          <h2>Pengajuan transaksi</h2>
          <p>
            Transaksi dicatat setelah disetujui member. Pengajuan di sini
            berasal dari link ini.
          </p>
        </div>
        {data.permissions.finance === "edit" && j.lifecycle === "active" && (
          <Button disabled={busy} onClick={() => open({ kind: "transaction" })}>
            Record transaction
          </Button>
        )}
      </div>
      <div className="table-wrap">
        <SelectionTable>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Transaksi</th>
              <th>Nominal</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.submissions.map((x) => (
              <tr key={x.id}>
                <td>{shortDate(x.data.date)}</td>
                <td>
                  <b>{x.data.title}</b>
                  <p>{x.data.description}</p>
                  {x.review_reason && <small>{x.review_reason}</small>}
                </td>
                <td>
                  {x.data.direction === "in" ? "+" : "−"}
                  {moneyLabel(x.data.amount)}
                </td>
                <td>
                  <span className="tag neutral">{x.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </SelectionTable>
      </div>
      {!data.submissions.length && (
        <p className="muted">Belum ada pengajuan.</p>
      )}
    </section>
  );
  return (
    <div className="shared-trip-shell">
      <header className="shared-trip-header">
        <CompanyIdentity logoOnly />
        <Button
          variant="outline"
          disabled={loading || busy || dirty || !!editor}
          onClick={() => void load()}
        >
          Refresh
        </Button>
      </header>
      <main className="workspace-content">
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <Detail
          journey={j}
          snapshot={snapshot}
          busy={busy}
          error={error}
          onCommand={run}
          onEdit={open}
          onNavigate={() => {}}
          onDirty={setDirty}
          shared={{ permissions: data.permissions, finance }}
        />
      </main>
      <PlatformFooter />
      {loading ? (
        <Toast pending message="Memuat hasil terbaru…" />
      ) : (
        notice && <Toast message={notice} onClose={() => setNotice("")} />
      )}
      {editor && (
        <Modal
          title={
            editor.kind === "task"
              ? "Public task"
              : editor.kind === "transaction"
                ? "Ajukan transaksi"
                : "Edit Trip"
          }
          open
          onClose={() => {
            if (confirm("Tutup editor? Input belum disimpan akan dibuang."))
              setEditor(null);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                get = (k: string) => String(f.get(k) || "");
              if (editor.kind === "task") {
                await run({
                  action: editor.task ? "update_task" : "create_task",
                  id: editor.task?.id,
                  version: editor.task?.version,
                  data: {
                    title: get("title"),
                    description: get("description"),
                    due: get("due"),
                  },
                });
              } else if (editor.kind === "transaction") {
                await run({
                  action: "submit_transaction",
                  data: {
                    title: get("title"),
                    date: get("date"),
                    direction: get("direction"),
                    amount: get("amount"),
                    category: get("category"),
                    description: get("description"),
                    idempotency_key: key.current,
                  },
                });
              } else {
                await run({
                  action: "update_journey",
                  id: j.id,
                  version: j.version,
                  data: {
                    name: get("name"),
                    trip_type: get("trip_type"),
                    start: get("start"),
                    end: get("end"),
                    guests: get("guests") ? Number(get("guests")) : null,
                  },
                });
              }
            }}
          >
            {editor.kind === "journey" ? (
              <>
                <label>
                  Nama Trip
                  <input
                    name="name"
                    required
                    maxLength={200}
                    defaultValue={j.name}
                  />
                </label>
                <label>
                  Tipe Trip
                  <input
                    name="trip_type"
                    maxLength={200}
                    defaultValue={j.trip_type}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Mulai
                    <input type="date" name="start" defaultValue={j.start} />
                  </label>
                  <label>
                    Selesai
                    <input type="date" name="end" defaultValue={j.end} />
                  </label>
                  <label>
                    Jumlah tamu
                    <input
                      type="number"
                      name="guests"
                      min={1}
                      max={100000}
                      defaultValue={j.guests ?? ""}
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <label>
                  Judul
                  <input
                    name="title"
                    required
                    maxLength={200}
                    defaultValue={editor.task?.title}
                  />
                </label>
                <label>
                  Note
                  <textarea
                    name="description"
                    maxLength={5000}
                    defaultValue={editor.task?.description}
                  />
                </label>
                {editor.kind === "task" ? (
                  <>
                    <p>Assignee: Public</p>
                    <label>
                      Due date
                      <input
                        name="due"
                        type="date"
                        defaultValue={editor.task?.due}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      Tanggal
                      <input
                        name="date"
                        required
                        type="date"
                        max={dateInZone()}
                        defaultValue={dateInZone()}
                      />
                    </label>
                    <label>
                      Arah
                      <select
                        name="direction"
                        defaultValue="out"
                        onChange={(e) => {
                          const form = e.target.form;
                          if (form) {
                            const category = form.elements.namedItem(
                              "category",
                            ) as HTMLSelectElement;
                            const options = Array.from(category.options);
                            options.forEach((o) => {
                              o.hidden = o.dataset.direction !== e.target.value;
                            });
                            category.value =
                              options.find((o) => !o.hidden)?.value || "";
                          }
                        }}
                      >
                        <option value="out">Expense / Payments</option>
                        <option value="in">Income / Receipts</option>
                      </select>
                    </label>
                    <label>
                      Kategori
                      <select
                        name="category"
                        required
                        defaultValue={
                          data.categories.find((c) => c.direction === "out")?.id
                        }
                      >
                        {data.categories.map((c) => (
                          <option
                            value={c.id}
                            key={c.id}
                            data-direction={c.direction}
                            hidden={c.direction !== "out"}
                          >
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Nominal IDR
                      <MoneyInput name="amount" label="Nominal IDR" required />
                    </label>
                  </>
                )}
              </>
            )}
            {error && (
              <p className="error-box" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <Button type="submit" disabled={busy}>
                {busy
                  ? "Menyimpan…"
                  : editor.kind === "transaction"
                    ? "Ajukan untuk approval"
                    : "Simpan"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
