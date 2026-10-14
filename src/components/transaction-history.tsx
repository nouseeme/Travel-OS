"use client";
import { SelectionTable } from "./selection-table";
import { useEffect, useState } from "react";
import type { Audit, Snapshot, Transaction } from "@/lib/model";
import { localTimestamp, localTimezone } from "@/lib/time";
import { moneyLabel, shortDate } from "@/lib/format";
const fields: Record<string, string> = {
  title: "Judul",
  date: "Tanggal transaksi",
  direction: "Arah",
  amount: "Nominal",
  category: "Kategori",
  trip: "Trip",
  description: "Catatan",
  status: "Status",
};
type Data = Record<string, unknown>;
const object = (v: unknown): Data | undefined =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Data) : undefined;
export function initialTransaction(events: Audit[], current: Transaction) {
  const chronological = [...events].sort(
    (a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id),
  );
  const created = chronological.find((e) => e.action === "create_transaction");
  const initial =
    object(created?.metadata.after) ||
    chronological.map((e) => object(e.metadata.before)).find(Boolean);
  // Legacy creation events did not store values. Current values are original only if no later edits exist.
  return (
    initial ||
    (current.version === 1 ? (current as unknown as Data) : undefined)
  );
}
export function TransactionHistory({
  transaction: t,
  snapshot: s,
}: {
  transaction: Transaction;
  snapshot: Snapshot;
}) {
  const [events, setEvents] = useState<Audit[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setEvents([]);
    (async () => {
      try {
        const all: Audit[] = [];
        let page = 0,
          count = 1;
        do {
          const q = new URLSearchParams({
            view: "audit",
            search: t.id,
            page: String(page++),
            timezone: localTimezone(),
          });
          const r = await fetch("/api/workspace?" + q, {
            cache: "no-store",
            signal: abort.signal,
          });
          const d: Snapshot & { error?: string } = await r.json();
          if (!r.ok) throw Error(d.error || "Riwayat tidak dapat dimuat.");
          const batch = d.audit || [];
          all.push(...batch);
          count = d.count || 0;
          if (!batch.length) break;
        } while (page * 50 < count);
        if (!abort.signal.aborted)
          setEvents(all.filter((e) => e.entity === t.id));
      } catch (e) {
        if (!abort.signal.aborted) setError((e as Error).message);
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    })();
    return () => abort.abort();
  }, [t.id, t.version, retry]);
  function display(key: string, v: unknown) {
    if (v === undefined || v === null || v === "") return "—";
    if (key === "amount") return moneyLabel(String(v));
    if (key === "date") return shortDate(String(v));
    if (key === "category")
      return s.categories.find((c) => c.id === v)?.name || String(v);
    if (key === "trip")
      return s.journeys.find((j) => j.id === v)?.name || String(v);
    if (key === "direction") return v === "in" ? "Penerimaan" : "Pengeluaran";
    return String(v);
  }
  const initial = initialTransaction(events, t),
    creation = events.find((e) => e.action === "create_transaction");
  const rows = events.filter((e) => e.action !== "create_transaction");
  return (
    <section className="transaction-history">
      <h3>Riwayat perubahan</h3>
      {loading ? (
        <p role="status">Memuat riwayat…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button className="text-button" onClick={() => setRetry(retry + 1)}>
            Coba lagi
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <SelectionTable>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Alasan</th>
                <th>Yang diubah</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  {localTimestamp(creation?.at || t.created_at)}
                  <small>
                    {
                      s.people.find(
                        (p) => p.id === (creation?.actor || t.created_by),
                      )?.name
                    }
                  </small>
                </td>
                <td>Pencatatan awal</td>
                <td>
                  {initial ? (
                    <details>
                      <summary>Record awal</summary>
                      <dl>
                        {Object.entries(fields).map(([k, label]) => (
                          <div key={k}>
                            <dt>{label}</dt>
                            <dd>{display(k, initial[k])}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  ) : (
                    "Pencatatan awal tersimpan; rincian nilai awal tidak tersedia pada audit lama."
                  )}
                </td>
              </tr>
              {rows
                .slice()
                .reverse()
                .map((e) => {
                  const before = object(e.metadata.before),
                    after = object(e.metadata.after);
                  const changed = Object.keys(fields).filter(
                    (k) =>
                      JSON.stringify(before?.[k]) !==
                      JSON.stringify(after?.[k]),
                  );
                  const action =
                    e.action === "edit_transaction"
                      ? "Koreksi diajukan"
                      : e.action === "approve_correction"
                        ? "Koreksi dikonfirmasi"
                        : e.action === "reject_correction"
                          ? "Koreksi ditolak"
                          : e.action === "void_transaction"
                            ? "Transaksi di-void"
                            : "Perubahan transaksi";
                  return (
                    <tr key={e.id}>
                      <td>
                        {localTimestamp(e.at)}
                        <small>
                          {s.people.find((p) => p.id === e.actor)?.name}
                        </small>
                      </td>
                      <td>
                        {String(e.metadata.reason || after?.reason || action)}
                      </td>
                      <td>
                        <b>{action}</b>
                        {changed.length && after ? (
                          <details>
                            <summary>
                              {changed.map((k) => fields[k]).join(", ")}
                            </summary>
                            <dl>
                              {changed.map((k) => (
                                <div key={k}>
                                  <dt>{fields[k]}</dt>
                                  <dd>
                                    <span>{display(k, before?.[k])}</span>
                                    <span aria-label="menjadi"> → </span>
                                    <span>{display(k, after[k])}</span>
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </details>
                        ) : (
                          <p>
                            Rincian perubahan tidak tersedia pada event ini.
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </SelectionTable>
        </div>
      )}
    </section>
  );
}
