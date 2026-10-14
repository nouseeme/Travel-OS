"use client";
import { SelectionTable } from "./selection-table";
import { MoneyInput } from "./money-input";
import { minorUnits, decimalString } from "@/lib/money";
import { useEffect, useState, useRef } from "react";
import type { Snapshot, Command, BudgetRow } from "@/lib/model";
import { Button } from "./ui/button";
import { can, moneyLabel } from "@/lib/format";
import { localTimezone } from "@/lib/time";

export function TripPipeline({
  s,
}: {
  s: Snapshot;
  run: (c: Command) => Promise<boolean>;
  busy: boolean;
}) {
  return (
    <section className="p1-panel">
      <h2>Pipeline Trips</h2>
      <p>
        Planned → Confirmed → In Progress. Trip yang Confirmed otomatis bergerak
        saat H−2 menggunakan tanggal workspace. Completed dan Cancelled masuk
        Archive.
      </p>
      <div className="row-actions">
        {s.tripStages
          ?.filter((st) => st.active && st.semantic === "open")
          .map((st) => (
            <span className="tag trip" key={st.id}>
              {st.label}
            </span>
          ))}
      </div>
    </section>
  );
}

export function Budget({
  s,
  run,
  busy,
  tripId,
}: {
  s: Snapshot;
  run: (c: Command) => Promise<boolean>;
  busy: boolean;
  tripId?: string;
}) {
  const [trip, setTrip] = useState(tripId || ""),
    [rows, setRows] = useState<BudgetRow[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const loadedTrip = useRef("");
  useEffect(() => {
    if (!trip) {
      setRows([]);
      setLoading(false);
      setError("");
      loadedTrip.current = "";
      return;
    }
    const controller = new AbortController();
    if (loadedTrip.current !== trip) {
      setRows([]);
      loadedTrip.current = trip;
    }
    setLoading(true);
    setError("");
    const q = new URLSearchParams({
      view: "finance",
      budget_trip: trip,
      timezone: localTimezone(),
    });
    fetch("/api/workspace?" + q, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        if (!controller.signal.aborted) setRows(data.budgets || []);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [trip, s]);
  const total = (direction: "in" | "out", field: "budget" | "actual") =>
    rows
      .filter((r) => r.direction === direction)
      .reduce((sum, r) => sum + minorUnits(r[field] || "0"), 0n);
  const budgetIn = total("in", "budget"),
    budgetOut = total("out", "budget"),
    actualIn = total("in", "actual"),
    actualOut = total("out", "actual");
  return (
    <section className="budget-panel">
      <div className="section-toolbar">
        <div>
          <h2>Budget vs actual</h2>
          <p>
            Rencana IDR per kategori · actual kas posted, All time · Void
            dikecualikan.
          </p>
        </div>
        {!tripId && (
          <label>
            Trip
            <select
              aria-label="Trip budget"
              value={trip}
              onChange={(e) => setTrip(e.target.value)}
            >
              <option value="">Pilih Trip</option>
              {s.journeys
                .filter((j) => j.kind === "trip")
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      {!trip && (
        <div className="notice">
          Pilih Trip untuk menetapkan rencana penerimaan dan pengeluaran.
        </div>
      )}
      {loading && <p role="status">Memuat budget…</p>}
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      {(!loading || rows.length > 0) &&
        !error &&
        trip &&
        rows.every((r) => r.trip === trip) && (
          <>
            <div className="p1-metrics">
              <div>
                Rencana Income / Receipts
                <b>{moneyLabel(decimalString(budgetIn))}</b>
              </div>
              <div>
                Rencana Expense / Payments
                <b>{moneyLabel(decimalString(budgetOut))}</b>
              </div>
              <div>
                Rencana hasil kas
                <b>{moneyLabel(decimalString(budgetIn - budgetOut))}</b>
              </div>
              <div>
                Actual hasil kas
                <b>{moneyLabel(decimalString(actualIn - actualOut))}</b>
              </div>
            </div>
            <div className="table-wrap">
              <SelectionTable
                actionLabel="Hapus budget terpilih"
                onDelete={
                  can(s.user, "finance", true) && can(s.user, "trips")
                    ? async (ids) => {
                        const selected = rows.filter(
                          (r) => ids.includes(r.category) && r.version !== null,
                        );
                        if (!selected.length) return false;
                        return run({
                          action: "bulk_action",
                          data: {
                            commands: selected.map((r) => ({
                              action: "delete_budget",
                              version: r.version,
                              data: { trip, category: r.category },
                            })),
                          },
                        });
                      }
                    : undefined
                }
              >
                <thead>
                  <tr>
                    <th>Kategori</th>
                    <th>Budget IDR</th>
                    <th>Actual IDR</th>
                    <th>Selisih menguntungkan</th>
                    <th>Rencana</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const variance =
                      r.direction === "in"
                        ? minorUnits(r.actual) - minorUnits(r.budget || "0")
                        : minorUnits(r.budget || "0") - minorUnits(r.actual);
                    const editable =
                      can(s.user, "finance", true) &&
                      r.active &&
                      r.lifecycle === "active";
                    return (
                      <tr key={r.category}>
                        <td>
                          <b>{r.label}</b>
                          <small>
                            {r.direction === "in"
                              ? "Income / Receipts"
                              : "Expense / Payments"}
                            {!r.active ? " · inactive" : ""}
                          </small>
                        </td>
                        <td className="amount-cell">
                          {r.budget === null
                            ? "Belum diatur"
                            : moneyLabel(r.budget)}
                        </td>
                        <td className="amount-cell">{moneyLabel(r.actual)}</td>
                        <td
                          className={
                            variance < 0n
                              ? "negative amount-cell"
                              : "positive amount-cell"
                          }
                        >
                          {r.budget === null
                            ? "—"
                            : moneyLabel(decimalString(variance))}
                        </td>
                        <td>
                          {editable ? (
                            <form
                              className="budget-edit"
                              key={r.category + String(r.version)}
                              onSubmit={async (e) => {
                                e.preventDefault();
                                const f = new FormData(e.currentTarget);
                                await run({
                                  action: "save_budget",
                                  version: r.version ?? undefined,
                                  data: {
                                    trip: r.trip,
                                    category: r.category,
                                    amount: f.get("amount"),
                                  },
                                });
                              }}
                            >
                              <MoneyInput
                                label={`Budget ${r.label}`}
                                name="amount"
                                value={r.budget ?? ""}
                                required
                              />
                              <Button size="sm" disabled={busy || loading}>
                                Simpan
                              </Button>
                            </form>
                          ) : (
                            <small>Hanya-baca</small>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </SelectionTable>
            </div>
            <p className="notice">
              Budget tidak membuat transaksi. Quoted price tidak dihitung
              sebagai budget atau kas. Selisih: penerimaan actual − budget;
              pengeluaran budget − actual. Rencana dan hasil kas bukan profit
              akuntansi.
            </p>
          </>
        )}
    </section>
  );
}

export function AuditDiff({ metadata }: { metadata: Record<string, unknown> }) {
  const before = metadata.before as Record<string, unknown> | undefined,
    after = metadata.after as Record<string, unknown> | undefined;
  const fields = [
    ...new Set([...Object.keys(before || {}), ...Object.keys(after || {})]),
  ].filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
  const display = (value: unknown) =>
    value === null || value === undefined
      ? "—"
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return (
    <details>
      <summary>
        {fields.length ? `${fields.length} field berubah` : "Lihat detail"}
      </summary>
      {fields.length > 0 && (
        <SelectionTable className="audit-diff">
          <thead>
            <tr>
              <th>Field</th>
              <th>Sebelum</th>
              <th>Sesudah</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field}>
                <td>{field}</td>
                <td>{display(before?.[field])}</td>
                <td>{display(after?.[field])}</td>
              </tr>
            ))}
          </tbody>
        </SelectionTable>
      )}
      {Object.entries(metadata)
        .filter(
          ([key, value]) =>
            !["before", "after"].includes(key) && value !== null,
        )
        .map(([key, value]) => (
          <p key={key}>
            <b>{key}</b>: {display(value)}
          </p>
        ))}
      {!fields.length && !Object.keys(metadata).length && (
        <p>Tidak ada perubahan field terperinci pada event ini.</p>
      )}
    </details>
  );
}
