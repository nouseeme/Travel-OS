"use client";
import { useState } from "react";
import type { Snapshot, Command } from "@/lib/model";
import { can, moneyLabel, shortDate } from "@/lib/format";
import { Button } from "./ui/button";
export function SubmissionReview({
  s,
  run,
  busy,
}: {
  s: Snapshot;
  run: (c: Command) => Promise<boolean>;
  busy: boolean;
}) {
  const [selected, setSelected] = useState("");
  if (!can(s.user, "finance", true) || !s.submissions?.length) return null;
  return (
    <section className="panel spaced-panel">
      <div className="panel-heading">
        <h2>
          Pengajuan transaksi publik{" "}
          <span className="pill">{s.submissions.length}</span>
        </h2>
      </div>
      {s.submissions.map((x) => (
        <article className="submission-row" key={x.id}>
          <div className="section-toolbar">
            <div>
              <b>{x.data.title}</b>
              <p>
                {shortDate(x.data.date)} ·{" "}
                {x.data.direction === "in" ? "+" : "−"}
                {moneyLabel(x.data.amount)} ·{" "}
                {s.journeys.find((j) => j.id === x.trip_id)?.name || "Trip"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelected(selected === x.id ? "" : x.id)}
            >
              Review
            </Button>
          </div>
          {selected === x.id && (
            <>
              <p>
                Kategori:{" "}
                {s.categories.find((c) => c.id === x.data.category)?.name ||
                  x.data.category}
              </p>
              <p className="plain-note">{x.data.description || "Tanpa note"}</p>
              <div className="row-actions">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Approve dan catat transaksi ini ke ledger?"))
                      void run({
                        action: "approve_submission",
                        id: x.id,
                        version: x.version,
                      });
                  }}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    const reason = prompt("Alasan menolak pengajuan:");
                    if (reason?.trim())
                      void run({
                        action: "reject_submission",
                        id: x.id,
                        version: x.version,
                        data: { reason },
                      });
                  }}
                >
                  Reject
                </Button>
              </div>
            </>
          )}
        </article>
      ))}
    </section>
  );
}
