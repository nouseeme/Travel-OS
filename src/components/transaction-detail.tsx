"use client";
import type { Snapshot, Transaction } from "@/lib/model";
import type { Editor } from "./forms";
import { moneyLabel, shortDate } from "@/lib/format";
import { TransactionHistory } from "./transaction-history";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";
export function TransactionDetail({
  transaction: t,
  snapshot: s,
  canEdit,
  onClose,
  onEdit,
}: {
  transaction: Transaction;
  snapshot: Snapshot;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (e: Editor) => void;
}) {
  const pending = s.corrections?.some((c) => c.transaction_id === t.id);
  const change = (kind: "transaction" | "void") => {
    onClose();
    onEdit({ kind, transaction: t });
  };
  return (
    <Modal
      open
      title={t.title || "Detail transaksi"}
      description="Detail pencatatan kas"
      onClose={onClose}
    >
      <div className="transaction-detail">
        <div className="transaction-amount">
          <strong
            className={
              t.status === "void"
                ? "muted"
                : t.direction === "in"
                  ? "positive"
                  : "negative"
            }
          >
            {t.direction === "in" ? "+" : "−"}
            {moneyLabel(t.amount)}
          </strong>
          <span className="tag neutral">
            {pending ? "Pending correction" : t.status}
          </span>
        </div>
        <dl className="transaction-facts">
          <div>
            <dt>Tanggal</dt>
            <dd>{shortDate(t.date)}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>
              {s.categories.find((c) => c.id === t.category)?.name || "—"}
            </dd>
          </div>
          <div>
            <dt>Context</dt>
            <dd>
              {t.trip
                ? s.journeys.find((j) => j.id === t.trip)?.name || "Trip"
                : "General"}
            </dd>
          </div>
          <div>
            <dt>Creator</dt>
            <dd>{s.people.find((p) => p.id === t.created_by)?.name || "—"}</dd>
          </div>
        </dl>
        <section className="transaction-note">
          <h3>Catatan</h3>
          <p>{t.description || "Tidak ada catatan."}</p>
        </section>
        <TransactionHistory transaction={t} snapshot={s} />
        <div className="form-footer">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
          {t.status === "posted" && (
            <>
              {canEdit && (
                <Button
                  disabled={pending}
                  onClick={() => change("transaction")}
                >
                  Ajukan koreksi
                </Button>
              )}
              {s.user.role === "admin" && (
                <Button variant="ghost" onClick={() => change("void")}>
                  Void
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
