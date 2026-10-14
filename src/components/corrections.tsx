"use client";
import { useState } from "react";
import type { Snapshot, Command, Transaction } from "@/lib/model";
import { moneyLabel, shortDate } from "@/lib/format";
import { Button } from "./ui/button";
export function Corrections({
  s,
  run,
  busy,
}: {
  s: Snapshot;
  run: (c: Command) => Promise<boolean>;
  busy: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  if (!s.corrections?.length) return null;
  function value(t: Partial<Transaction>, field: keyof Transaction): string {
    if (field === "amount")
      return `${t.direction === "in" ? "+" : "−"}${moneyLabel(t.amount || "0")}`;
    if (field === "category")
      return (
        s.categories.find((c) => c.id === t.category)?.name || t.category || "—"
      );
    if (field === "trip")
      return (
        s.journeys.find((j) => j.id === t.trip)?.name || t.trip || "General"
      );
    if (field === "date") return shortDate(t.date || "");
    return String(t[field] || "—");
  }
  return (
    <section className="correction-panel">
      <h2>
        Menunggu konfirmasi admin{" "}
        <span className="pill">{s.corrections.length}</span>
      </h2>
      {s.corrections.map((cr) => {
        const original =
          cr.original || s.transactions.find((t) => t.id === cr.transaction_id);
        const review = selected === cr.id;
        return (
          <article key={cr.id}>
            <div className="section-toolbar">
              <div>
                <b>{cr.proposed.title || "Koreksi transaksi"}</b>
                <p>
                  {s.people.find((p) => p.id === cr.requested_by)?.name} ·{" "}
                  {cr.reason}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelected(review ? null : cr.id)}
              >
                {review ? "Tutup" : "Review"}
              </Button>
            </div>
            {review && (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Tercatat</th>
                        <th>Koreksi diajukan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          "title",
                          "date",
                          "amount",
                          "category",
                          "trip",
                          "description",
                        ] as const
                      ).map((field) => (
                        <tr key={field}>
                          <td>{field}</td>
                          <td>{original ? value(original, field) : "—"}</td>
                          <td>{value(cr.proposed, field)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {s.user.role === "admin" && (
                  <div className="row-actions">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(
                            "Konfirmasi dan terapkan koreksi ini ke ledger?",
                          )
                        )
                          run({
                            action: "approve_correction",
                            id: cr.id,
                            version: cr.version,
                          });
                      }}
                    >
                      Confirm correction
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        const reason = prompt("Alasan menolak koreksi:");
                        if (reason?.trim())
                          run({
                            action: "reject_correction",
                            id: cr.id,
                            version: cr.version,
                            data: { reason },
                          });
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </>
            )}
          </article>
        );
      })}
    </section>
  );
}
