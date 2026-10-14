"use client";
import { useState } from "react";
import type {
  Snapshot,
  Journey,
  Task,
  Transaction,
  Person,
  Command,
  Module,
  Invitation,
} from "@/lib/model";
import { noPrivileges, stages, tripStages } from "@/lib/model";
import { can } from "@/lib/format";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";
import { MoneyInput } from "./money-input";
export type Editor = {
  kind:
    | "journey"
    | "task"
    | "transaction"
    | "invite"
    | "permissions"
    | "archive"
    | "void"
    | "convert"
    | "restore";
  journey?: Journey;
  task?: Task;
  transaction?: Transaction;
  person?: Person;
  invitation?: Invitation;
  context?: "lead" | "trip" | "internal";
  direction?: "in" | "out";
};
function Field({
  label,
  name,
  value = "",
  type = "text",
  required = false,
  min,
  max,
  hint,
}: {
  label: string;
  name: string;
  value?: string | number;
  type?: string;
  required?: boolean;
  min?: number;
  max?: string;
  hint?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        defaultValue={value}
        type={type}
        required={required}
        min={min}
        max={max}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Privileges({ user }: { user?: Pick<Person, "privileges"> }) {
  return (
    <div className="privilege-fields">
      {(["sales", "trips", "finance", "docs"] as Module[]).map((m) => (
        <label key={m}>
          {m[0].toUpperCase() + m.slice(1)}
          <select name={m} defaultValue={user?.privileges[m] || "none"}>
            <option value="none">None · Tidak ada akses</option>
            <option value="view">View · Baca</option>
            <option value="edit">Edit · Kelola</option>
          </select>
        </label>
      ))}
    </div>
  );
}
export function Forms({
  editor: e,
  snapshot: s,
  error,
  busy,
  onClose,
  onSubmit,
}: {
  editor: Editor;
  snapshot: Snapshot;
  error: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (c: Command) => Promise<boolean>;
}) {
  const [direction, setDirection] = useState(
    e.transaction?.direction || e.direction || "in",
  );
  const j = e.journey,
    t = e.task,
    tx = e.transaction;
  const trip =
    e.context === "trip" || e.kind === "convert" || j?.kind === "trip";
  const module: Module = trip ? "trips" : "sales";
  const eligible = s.people.filter((p) => can(p, module));
  const title = {
    journey: j ? "Edit detail" : trip ? "Tambah Trip" : "Tambah Lead",
    task: t ? "Edit task" : "Tambah task",
    transaction: tx ? "Ajukan koreksi transaksi" : "Record transaction",
    invite: "Undang member",
    permissions: "Atur privilege",
    archive: "Archive lead / trip",
    void: "Void transaksi",
    convert: "Convert lead menjadi Trip",
    restore: "Restore lead",
  }[e.kind];
  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const get = (key: string) => String(f.get(key) || "");
    let c: Command = { action: "" };
    if (e.kind === "journey" || e.kind === "convert") {
      const pic = get("pic");
      if (
        j &&
        pic !== j.pic &&
        f.has("reassign") &&
        !confirm(
          "Pindahkan unfinished tasks ke PIC baru? Completed/cancelled task tidak berubah.",
        )
      )
        return;
      const d = {
        kind: trip ? "trip" : "lead",
        name: get("name"),
        client: get("client"),
        pic,
        people: trip ? f.getAll("people").map(String) : [pic],
        start: get("start"),
        end: get("end"),
        guests: get("guests") ? Number(get("guests")) : null,
        quote: get("quote"),
        stage:
          get("stage") ||
          (trip
            ? s.tripStages?.find((x) => x.is_default && x.active)?.id ||
              "Planned"
            : s.salesStages?.find((x) => x.is_default && x.active)?.id ||
              "Drafts"),
        trip_type: get("trip_type"),
        client_type: get("client_type"),
        reassign_unfinished: f.has("reassign"),
      };
      if (e.kind === "convert") {
        c = {
          action: "convert",
          id: j!.id,
          version: j!.version,
          data: {
            ...d,
            assignments: Object.fromEntries(
              [...f]
                .filter(([key]) => key.startsWith("assignment:"))
                .map(([key, v]) => [key.slice(11), String(v)]),
            ),
          },
        };
      } else
        c = {
          action: j ? "update_journey" : "create_journey",
          id: j?.id,
          version: j?.version,
          data: d,
        };
    }
    if (e.kind === "task")
      c = {
        action: t ? "update_task" : "create_task",
        id: t?.id,
        version: t?.version,
        data: {
          title: get("title"),
          description: get("description"),
          due: get("due"),
          assignee: get("assignee"),
          context: t?.context || e.context || "internal",
          parent: t?.parent || j?.id || null,
        },
      };
    if (e.kind === "transaction")
      c = {
        action: tx ? "edit_transaction" : "create_transaction",
        id: tx?.id,
        version: tx?.version,
        data: {
          date: get("date"),
          direction,
          amount: get("amount"),
          category: get("category"),
          trip: get("trip") || null,
          title: get("title"),
          description: get("description"),
          reason: get("reason"),
          idempotency_key: get("idempotency_key"),
        },
      };
    if (e.kind === "invite")
      c = {
        action: "invite",
        data: {
          email: get("email"),
          name: get("name"),
          privileges: {
            sales: get("sales"),
            trips: get("trips"),
            finance: get("finance"),
            docs: get("docs"),
          },
        },
      };
    if (e.kind === "permissions")
      c = {
        action: e.invitation ? "update_invitation" : "update_person",
        id: e.invitation?.id || e.person!.id,
        version: e.invitation?.version || e.person!.version,
        data: {
          ...(e.person ? { role: get("role") } : {}),
          privileges: {
            sales: get("sales"),
            trips: get("trips"),
            finance: get("finance"),
            docs: get("docs"),
          },
        },
      };
    if (e.kind === "archive")
      c = {
        action: "archive",
        id: j!.id,
        version: j!.version,
        data: {
          lost: get("outcome") === "lost",
          outcome: get("outcome"),
          reason: get("reason"),
          cancel: f.has("cancel"),
        },
      };
    if (e.kind === "void")
      c = {
        action: "void_transaction",
        id: tx!.id,
        version: tx!.version,
        data: { reason: get("reason") },
      };
    if (e.kind === "restore")
      c = {
        action: "restore",
        id: j!.id,
        version: j!.version,
        data: { pic: get("pic") },
      };
    await onSubmit(c);
  }
  const [key] = useState(() => crypto.randomUUID());
  const taskReadOnly =
    t &&
    (t.context === "internal"
      ? t.assignee !== s.user.id
      : !can(s.user, t.context === "lead" ? "sales" : "trips", true));
  if (e.kind === "task" && taskReadOnly)
    return (
      <Modal open title="Lihat task" onClose={onClose}>
        <div className="modal-form">
          <h3>{t.title}</h3>
          <p>{t.description || "Tanpa catatan"}</p>
          <p>
            Status: {t.status} · Due: {t.due || "Tanpa tanggal"}
          </p>
          <p>
            Assignee:{" "}
            {t.assignee === "public"
              ? "Public"
              : s.people.find((p) => p.id === t.assignee)?.name}
          </p>
          <small>Hanya-baca</small>
        </div>
      </Modal>
    );
  return (
    <Modal
      title={title}
      open
      onClose={onClose}
      description={
        e.kind === "convert"
          ? "Salinan notes, contacts, dan itinerary akan dibuat. Unfinished task dipindahkan dengan ID yang sama. Tidak ada transaksi kas otomatis."
          : e.kind === "transaction"
            ? "Catat kas dalam IDR, maksimal 2 desimal. Koreksi akan menunggu persetujuan admin."
            : undefined
      }
    >
      <form onSubmit={submit} className="modal-form">
        {(e.kind === "journey" || e.kind === "convert") && (
          <>
            <div className="form-grid">
              <Field
                label={trip ? "Nama trip *" : "Judul lead"}
                name="name"
                value={j?.name}
                required={trip}
              />
              <Field
                label="Nama klien *"
                name="client"
                value={j?.client}
                required
              />
              <label>
                PIC *
                <select name="pic" defaultValue={j?.pic || s.user.id} required>
                  <option value="">Pilih PIC</option>
                  {eligible.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {e.kind !== "convert" && (
                <label>
                  Stage
                  <select
                    name="stage"
                    defaultValue={
                      j?.stage ||
                      (trip
                        ? s.tripStages?.find((x) => x.is_default && x.active)
                            ?.id || "Planned"
                        : s.salesStages?.find((x) => x.is_default && x.active)
                            ?.id || "Drafts")
                    }
                  >
                    {(trip
                      ? s.tripStages?.filter((x) => x.active) ||
                        tripStages.map((id) => ({ id, label: id }))
                      : s.salesStages?.filter((x) => x.active) ||
                        stages.map((id) => ({ id, label: id }))
                    ).map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Field
                label="Tanggal mulai"
                name="start"
                value={j?.start}
                type="date"
                required={trip}
              />
              <Field
                label="Tanggal selesai"
                name="end"
                value={j?.end}
                type="date"
                required={trip}
              />
              <Field
                label="Jumlah tamu"
                name="guests"
                value={j?.guests || ""}
                type="number"
                min={1}
                required={trip}
              />
              {trip && (
                <label>
                  Quoted total IDR
                  <MoneyInput
                    name="quote"
                    label="Quoted total IDR"
                    value={j?.quote}
                  />
                  <small>Tidak masuk ledger kas.</small>
                </label>
              )}
              <Field label="Trip type" name="trip_type" value={j?.trip_type} />
              <Field
                label="Client type"
                name="client_type"
                value={j?.client_type}
              />
            </div>
            {trip && (
              <fieldset>
                <legend>Assigned people * (termasuk PIC)</legend>
                <div className="checks">
                  {eligible.map((p) => (
                    <label className="check" key={p.id}>
                      <input
                        type="checkbox"
                        name="people"
                        value={p.id}
                        defaultChecked={
                          j ? j.people.includes(p.id) : p.id === s.user.id
                        }
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {e.kind === "convert" &&
              s.tasks
                .filter(
                  (t) =>
                    t.parent === j!.id &&
                    t.status !== "Done" &&
                    !t.cancelled_at,
                )
                .map((t) => (
                  <label key={t.id}>
                    Assignee setelah conversion: {t.title}
                    <select
                      name={"assignment:" + t.id}
                      required
                      defaultValue={
                        eligible.some((p) => p.id === t.assignee)
                          ? t.assignee
                          : ""
                      }
                    >
                      <option value="">
                        Pilih pengganti (Trips access wajib)
                      </option>
                      {eligible.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
          </>
        )}
        {j && e.kind === "journey" && (
          <label className="check">
            <input type="checkbox" name="reassign" />
            Jika PIC berubah, reassign unfinished tasks (meminta konfirmasi).
            Default: assignment lama tetap.
          </label>
        )}
        {e.kind === "task" && (
          <>
            <Field
              label="Judul task *"
              name="title"
              value={t?.title}
              required
            />
            <label>
              Deskripsi
              <textarea name="description" defaultValue={t?.description} />
            </label>
            <div className="form-grid">
              <label>
                Assignee *
                <select
                  name="assignee"
                  defaultValue={
                    t?.assignee || (j?.kind === "lead" ? j.pic : s.user.id)
                  }
                  required
                >
                  {(t?.context || e.context) === "trip" && (
                    <option value="public">Public</option>
                  )}
                  {s.people
                    .filter(
                      (p) =>
                        p.status === "active" &&
                        ((t?.context || e.context) === "internal"
                          ? p.id === s.user.id
                          : can(
                              p,
                              (t?.context || e.context) === "lead"
                                ? "sales"
                                : "trips",
                            )),
                    )
                    .map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <Field label="Due date" name="due" value={t?.due} type="date" />
            </div>
            <div className="notice">
              Task yang sama akan terlihat di Home assignee dan detail parent.
            </div>
          </>
        )}
        {e.kind === "transaction" && (
          <>
            <input type="hidden" name="idempotency_key" value={key} />
            <div className="form-grid">
              <Field
                label="Transaction date *"
                name="date"
                value={tx?.date || s.today}
                type="date"
                max={s.today}
                required
              />
              <label>
                Direction
                <select
                  value={direction}
                  onChange={(ev) =>
                    setDirection(ev.target.value as "in" | "out")
                  }
                >
                  <option value="in">Income / Receipts</option>
                  <option value="out">Expense / Payments</option>
                </select>
              </label>
              <label>
                Amount IDR *
                <MoneyInput
                  name="amount"
                  label="Amount IDR"
                  value={tx?.amount}
                  required
                  autoFocus
                />
                <small>Contoh 1.250.000,50 · maksimal 2 desimal</small>
              </label>
              <Field
                label="Judul *"
                name="title"
                value={tx?.title || tx?.description}
                required
              />
              <label>
                Category *
                <select
                  name="category"
                  key={direction}
                  defaultValue={tx?.direction === direction ? tx.category : ""}
                  required
                >
                  <option value="">Pilih category</option>
                  {s.categories
                    .filter(
                      (c) =>
                        c.direction === direction &&
                        (c.active !== false || c.id === tx?.category),
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <label>
              Context
              <select name="trip" defaultValue={tx?.trip || j?.id || ""}>
                <option value="">General</option>
                {can(s.user, "trips") &&
                  s.journeys
                    .filter((j) => j.kind === "trip")
                    .map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name}
                      </option>
                    ))}
              </select>
            </label>
            <label>
              Catatan (opsional)
              <textarea name="description" defaultValue={tx?.description} />
            </label>
            {tx && <Field label="Alasan koreksi *" name="reason" required />}
          </>
        )}
        {e.kind === "invite" && (
          <>
            <div className="form-grid">
              <Field label="Nama *" name="name" required />
              <Field label="Email *" name="email" type="email" required />
            </div>
            <Privileges />
            <div className="notice">
              Member bergabung lewat link invitation. Defaults tanpa akses
              modul.
            </div>
          </>
        )}
        {e.kind === "permissions" && (
          <>
            <p>
              Privilege untuk{" "}
              <strong>{e.invitation?.name || e.person!.name}</strong>. Berlaku
              pada request berikutnya; pending invitation memakai privilege
              terbaru saat activation.
            </p>
            {e.person && (
              <label>
                Role
                <select name="role" defaultValue={e.person.role}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <small>
                  Admin mengelola orang, melihat task tim di Home, mengonfirmasi
                  koreksi dan void. Akses modul mengikuti privilege.
                </small>
              </label>
            )}
            <Privileges user={e.invitation || e.person} />
          </>
        )}
        {e.kind === "archive" && (
          <>
            <label>
              Outcome
              <select name="outcome">
                <option value="archive">Archive manual</option>
                {j?.kind === "lead" ? (
                  <option value="lost">Mark Lost</option>
                ) : (
                  <>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </>
                )}
              </select>
            </label>
            <Field label="Alasan (opsional)" name="reason" />
            <label className="check">
              <input type="checkbox" name="cancel" defaultChecked />
              Cancel unfinished tasks
            </label>
            <p className="muted">
              Record tetap tersimpan. Completed tasks tidak berubah.
            </p>
          </>
        )}
        {e.kind === "restore" && (
          <>
            <div className="notice">
              Pilih PIC aktif untuk mengembalikan lead. Cancelled tasks tetap
              dibatalkan.
            </div>
            <label>
              PIC *
              <select
                name="pic"
                required
                defaultValue={
                  eligible.some((p) => p.id === j!.pic) ? j!.pic : ""
                }
              >
                <option value="">Pilih PIC</option>
                {eligible.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {e.kind === "void" && (
          <>
            <div className="notice">
              Void hanya untuk entry salah/duplikat. Refund riil harus dicatat
              sebagai Expense / Payments baru. Void bersifat final.
            </div>
            <Field label="Alasan void *" name="reason" required />
          </>
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
            {error.includes("berubah") && (
              <span> Tutup dialog dan Reload, atau salin input dahulu.</span>
            )}
          </div>
        )}
        <div className="form-footer">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Batal
          </Button>
          <Button disabled={busy}>
            {busy
              ? "Menyimpan…"
              : e.kind === "convert"
                ? "Convert ke Trip"
                : e.kind === "invite"
                  ? "Buat link invitation"
                  : "Simpan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
