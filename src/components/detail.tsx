"use client";
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Plus,
  CalendarDays,
  Users,
  Wallet,
  Share2,
  ArrowRight,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  MapPin,
  Save,
  Eye,
  Copy,
  CheckCircle2,
  Phone,
  Mail,
} from "lucide-react";
import { ApplyTemplate } from "./p1";
import { Sharing } from "./sharing";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type {
  Journey,
  Snapshot,
  Command,
  Note,
  Day,
  Contact,
  Task,
  Filters,
} from "@/lib/model";
import { taskStages } from "@/lib/model";
import {
  can,
  shortDate,
  moneyLabel,
  initials,
  deadline,
  periodLabel,
} from "@/lib/format";
import { Button } from "./ui/button";
import { Markdown } from "./markdown";
import { RichEditor } from "./rich-editor";
import { localTimezone } from "@/lib/time";
import type { Editor } from "./forms";
import { CashStats, Ledger, Pagination } from "./dashboard";
type Props = {
  journey: Journey;
  snapshot: Snapshot;
  busy: boolean;
  error: string;
  onCommand: (c: Command) => Promise<boolean>;
  onEdit: (e: Editor) => void;
  onNavigate: (u: string) => void;
  onDirty: (v: boolean) => void;
};
type ContentDraft = Partial<Pick<Journey, "notes" | "contacts" | "days">>;
export function Detail({
  journey: j,
  snapshot: s,
  busy,
  onCommand: run,
  onEdit: open,
  onNavigate: nav,
  onDirty,
}: Props) {
  const [tab, setTab] = useState("overview"),
    [dirtyAreas, setDirtyAreas] = useState<Record<string, boolean>>({}),
    [drafts, setDrafts] = useState<ContentDraft>({});
  const localDirty = Object.values(dirtyAreas).some(Boolean);
  useEffect(() => {
    onDirty(localDirty);
  }, [localDirty, onDirty]);
  useEffect(() => {
    setDrafts({});
    setDirtyAreas({});
  }, [j.version]);
  const edit =
    can(s.user, j.kind === "lead" ? "sales" : "trips", true) &&
    j.lifecycle === "active";
  function areaDirty(area: string, v: boolean, content?: ContentDraft) {
    setDirtyAreas((prev) => ({ ...prev, [area]: v }));
    if (content) setDrafts((prev) => ({ ...prev, ...content }));
  }
  async function saveContent(command: Command) {
    const saved = await run({
      ...command,
      data: { ...drafts, ...command.data },
    });
    if (saved) {
      setDrafts({});
      setDirtyAreas({});
    }
    return saved;
  }
  function switchTab(t: string) {
    if (
      localDirty &&
      !confirm("Ada perubahan belum disimpan. Ganti tab dan buang perubahan?")
    )
      return;
    setDrafts({});
    setDirtyAreas({});
    setTab(t);
  }
  const tabs =
    j.kind === "lead"
      ? [
          ["overview", "Overview & Notes"],
          ["itinerary", "Itinerary Draft"],
        ]
      : [
          ["overview", "Overview"],
          ["notes", "Notes"],
          ["itinerary", "Itinerary"],
          ["contacts", "Contacts"],
          ...(can(s.user, "finance") ? [["finance", "Finance"]] : []),
          ...(s.user.role === "admin" ? [["sharing", "Share preview"]] : []),
        ];
  const pic = s.people.find((p) => p.id === j.pic);
  return (
    <>
      <button
        className="back-link"
        onClick={() => nav("/" + (j.kind === "lead" ? "sales" : "trips"))}
      >
        <ArrowLeft size={15} />
        Kembali ke {j.kind === "lead" ? "Sales" : "Trips"}
      </button>
      <section className="detail-heading">
        <div>
          <div className="card-tags">
            <span className="tag trip">
              {s.salesStages?.find((x) => x.id === j.stage)?.label || j.stage}
            </span>
            <span className="tag neutral">{j.trip_type || "Custom trip"}</span>
            {j.lifecycle !== "active" && (
              <span className="tag lead">{j.lifecycle}</span>
            )}
          </div>
          <h1>{j.name || j.client}</h1>
          <p>
            {j.client} <span>·</span>{" "}
            {j.kind === "lead" ? "Sales opportunity" : "Trip workspace"}
          </p>
        </div>
        <div className="heading-actions">
          {edit && (
            <Button
              variant="outline"
              onClick={() =>
                open({ kind: "journey", journey: j, context: j.kind })
              }
            >
              Edit detail
            </Button>
          )}
          {edit && j.kind === "lead" && can(s.user, "trips", true) && (
            <Button onClick={() => open({ kind: "convert", journey: j })}>
              Convert to Trip
              <ArrowRight size={16} />
            </Button>
          )}
          {j.kind === "trip" && s.user.role === "admin" && (
            <Button
              variant="outline"
              disabled
              title="External sharing belum diaktifkan sampai security gate lulus"
            >
              <Share2 size={15} />
              Share
            </Button>
          )}
          {edit && (
            <Button
              variant="ghost"
              onClick={() => open({ kind: "archive", journey: j })}
            >
              Archive
            </Button>
          )}
          {j.kind === "lead" &&
            j.lifecycle !== "active" &&
            j.lifecycle !== "converted" &&
            can(s.user, "sales", true) && (
              <Button
                onClick={() =>
                  open({ kind: "restore", journey: j, context: "lead" })
                }
              >
                Restore
              </Button>
            )}
        </div>
      </section>
      {j.lifecycle !== "active" && (
        <div className="notice">
          Archive · {shortDate(j.archived_at || "")} ·{" "}
          {j.lost_reason || "Record read-only."}
          {j.converted_trip && can(s.user, "trips") && (
            <button
              className="text-button"
              onClick={() => nav("/trips/" + j.converted_trip!)}
            >
              Buka hasil conversion
              <ArrowUpRightFallback />
            </button>
          )}
        </div>
      )}
      {edit && (
        <ApplyTemplate s={s} j={j} busy={busy || localDirty} run={run} />
      )}
      <div className="detail-tabs">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "selected" : ""}
            onClick={() => switchTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "sharing" && <Sharing j={j} />}
      {tab === "overview" && (
        <>
          <div className="detail-overview">
            <article className="panel">
              <div className="panel-heading">
                <h2>Ringkasan {j.kind === "trip" ? "Trip" : "Lead"}</h2>
                <span className="tag neutral">{j.client_type || "Client"}</span>
              </div>
              <div className="facts-grid">
                <div>
                  <small>Tanggal perjalanan</small>
                  <b>
                    <CalendarDays size={15} />
                    {j.start
                      ? `${shortDate(j.start)} — ${shortDate(j.end)}`
                      : "Belum ditentukan"}
                  </b>
                </div>
                <div>
                  <small>Jumlah tamu</small>
                  <b>
                    <Users size={15} />
                    {j.guests || "Belum ditentukan"} {j.guests ? "tamu" : ""}
                  </b>
                </div>
                <div>
                  <small>PIC</small>
                  <b>
                    <span className="avatar mini">
                      {initials(pic?.name || "?")}
                    </span>
                    {pic?.name}
                  </b>
                </div>
                {j.kind === "trip" && (
                  <div>
                    <small>Quoted total · IDR</small>
                    <b>
                      <Wallet size={15} />
                      {j.quote ? moneyLabel(j.quote) : "Belum ditentukan"}
                    </b>
                  </div>
                )}
              </div>
              {j.kind === "trip" && (
                <div className="assigned-people">
                  <small>Assigned people</small>
                  <div>
                    {j.people.map((p) => (
                      <span className="pill" key={p}>
                        <span className="avatar mini">
                          {initials(
                            s.people.find((x) => x.id === p)?.name || "?",
                          )}
                        </span>
                        {s.people.find((x) => x.id === p)?.name}
                      </span>
                    ))}
                  </div>
                  <p className="muted">
                    Quoted price adalah metadata komersial. Tidak membuat
                    transaksi otomatis.
                  </p>
                </div>
              )}
            </article>
            <article className="panel task-panel">
              <div className="panel-heading">
                <h2>Trip context</h2>
                <MapPin size={18} />
              </div>
              <div className="context-step">
                <span className="route-mini-dot" />
                <div>
                  <b>
                    {j.kind === "lead" ? "Opportunity aktif" : "Perjalanan tim"}
                  </b>
                  <p>
                    {j.kind === "lead"
                      ? "Siapkan kebutuhan klien dan itinerary sebelum conversion."
                      : "Notes, itinerary, contacts, dan task tersimpan dalam satu konteks."}
                  </p>
                </div>
              </div>
              {j.source_lead && can(s.user, "sales") && (
                <button
                  className="text-button"
                  onClick={() => nav("/sales/" + j.source_lead)}
                >
                  Buka sumber Lead
                  <ArrowRight size={14} />
                </button>
              )}
              <div className="notice compact">
                Akses mengikuti privilege modul. PIC bukan batas kerahasiaan
                antaranggota.
              </div>
            </article>
          </div>
          <Tasks s={s} j={j} edit={edit} busy={busy} run={run} open={open} />
          {j.kind === "lead" && (
            <>
              {localDirty && (
                <div className="notice">
                  Simpan di halaman ini akan menyimpan seluruh perubahan notes
                  dan contacts bersama.
                </div>
              )}
              <Notes
                j={j}
                edit={edit}
                busy={busy}
                run={saveContent}
                dirty={(v, d) => areaDirty("notes", v, d)}
              />
              <Contacts
                j={j}
                edit={edit}
                busy={busy}
                run={saveContent}
                dirty={(v, d) => areaDirty("contacts", v, d)}
              />
            </>
          )}
        </>
      )}
      {tab === "notes" && (
        <Notes
          j={j}
          edit={edit}
          busy={busy}
          run={saveContent}
          dirty={(v, d) => areaDirty("notes", v, d)}
        />
      )}
      {tab === "itinerary" && (
        <Itinerary
          j={j}
          edit={edit}
          busy={busy}
          run={saveContent}
          dirty={(v, d) => areaDirty("days", v, d)}
        />
      )}
      {tab === "contacts" && (
        <Contacts
          j={j}
          edit={edit}
          busy={busy}
          run={saveContent}
          dirty={(v, d) => areaDirty("contacts", v, d)}
        />
      )}
      {tab === "finance" && can(s.user, "finance") && (
        <TripFinance j={j} s={s} open={open} />
      )}
    </>
  );
}
function CopyChanges({ value }: { value: unknown }) {
  const [copied, setCopied] = useState(false),
    [failed, setFailed] = useState(false);
  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
            setCopied(true);
            setFailed(false);
          } catch {
            setFailed(true);
          }
        }}
      >
        <Copy size={14} />
        {copied ? "Copied" : "Copy changes"}
      </Button>
      {failed && (
        <small>
          Clipboard tidak tersedia. Salin teks editor secara manual sebelum
          Reload.
        </small>
      )}
    </div>
  );
}
function ArrowUpRightFallback() {
  return <ArrowRight size={14} />;
}
function Tasks({
  s,
  j,
  edit,
  busy,
  run,
  open,
}: {
  s: Snapshot;
  j: Journey;
  edit: boolean;
  busy: boolean;
  run: (c: Command) => Promise<boolean>;
  open: (e: Editor) => void;
}) {
  const tasks = s.tasks.filter((t) => t.parent === j.id);
  return (
    <section className="panel spaced-panel">
      <div className="panel-heading">
        <div>
          <h2>
            Tasks <span className="subtle-count">{tasks.length}</span>
          </h2>
          <p>Pekerjaan ini juga muncul di Home assignee.</p>
        </div>
        {edit && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => open({ kind: "task", journey: j, context: j.kind })}
          >
            <Plus size={15} />
            Tambah task
          </Button>
        )}
      </div>
      {tasks.length ? (
        tasks.map((t) => (
          <div className="task-row" key={t.id}>
            <CheckCircle2
              size={17}
              className={t.status === "Done" ? "positive" : "muted"}
            />
            <div className="task-row-main">
              <b>{t.title}</b>
              {t.description && <p>{t.description}</p>}
              <small>
                {s.people.find((p) => p.id === t.assignee)?.name} ·{" "}
                {shortDate(t.due)}{" "}
                {deadline(t, s.today) && (
                  <span className="due-badge overdue">
                    {deadline(t, s.today)}
                  </span>
                )}
              </small>
            </div>
            <select
              aria-label={`Status ${t.title}`}
              value={t.status}
              disabled={
                busy ||
                (!edit && t.assignee !== s.user.id && s.user.role !== "admin")
              }
              onChange={(e) =>
                run({
                  action: "task_status",
                  id: t.id,
                  version: t.version,
                  data: { status: e.target.value },
                })
              }
            >
              {taskStages.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            {edit && (
              <>
                <button
                  className="text-button tiny"
                  onClick={() =>
                    open({ kind: "task", task: t, context: t.context })
                  }
                >
                  Edit
                </button>
                <button
                  className="icon-button negative"
                  aria-label={`Cancel ${t.title}`}
                  onClick={() => {
                    if (confirm("Cancel task ini?"))
                      run({
                        action: "cancel_task",
                        id: t.id,
                        version: t.version,
                      });
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        ))
      ) : (
        <div className="empty-state small">
          <CheckCircle2 size={23} />
          <p>Belum ada task. Tentukan langkah berikutnya untuk tim.</p>
        </div>
      )}
    </section>
  );
}
type ContentProps = {
  j: Journey;
  edit: boolean;
  busy: boolean;
  run: (c: Command) => Promise<boolean>;
  dirty: (v: boolean, content?: ContentDraft) => void;
};
function Notes({ j, edit, busy, run, dirty }: ContentProps) {
  const [notes, setNotes] = useState<Note[]>(structuredClone(j.notes)),
    [selected, setSelected] = useState(j.notes[0]?.id || ""),
    [changed, setChanged] = useState(false);
  useEffect(() => {
    setNotes(structuredClone(j.notes));
    setChanged(false);
    dirty(false);
  }, [j.version]);
  const note = notes.find((n) => n.id === selected) || notes[0];
  function update(next: Note[]) {
    setNotes(next);
    setChanged(true);
    dirty(true, { notes: next });
  }
  async function save() {
    if (
      await run({
        action: "content",
        id: j.id,
        version: j.version,
        data: { notes },
      })
    ) {
      setChanged(false);
      dirty(false);
    }
  }
  return (
    <section className="panel spaced-panel">
      <div className="panel-heading">
        <div>
          <h2>Notes</h2>
          <p>Named Markdown documents · simpan secara eksplisit</p>
        </div>
        <div className="row-actions">
          {edit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const id = crypto.randomUUID();
                update([...notes, { id, title: "Catatan baru", body: "" }]);
                setSelected(id);
              }}
            >
              <Plus size={14} />
              Note
            </Button>
          )}
          {edit && (
            <Button size="sm" disabled={!changed || busy} onClick={save}>
              <Save size={14} />
              Simpan notes
            </Button>
          )}
          {changed && <CopyChanges value={notes} />}
        </div>
      </div>
      <div className="note-layout">
        <aside className="note-list">
          {notes.map((n) => (
            <button
              key={n.id}
              className={n.id === note?.id ? "selected" : ""}
              onClick={() => setSelected(n.id)}
            >
              {n.title}
            </button>
          ))}
        </aside>
        <div className="note-body">
          {note && (
            <>
              {edit ? (
                <div className="note-title-row">
                  <input
                    aria-label="Judul note"
                    value={note.title}
                    onChange={(e) =>
                      update(
                        notes.map((n) =>
                          n.id === note.id
                            ? { ...n, title: e.target.value }
                            : n,
                        ),
                      )
                    }
                  />
                  <button
                    className="icon-button negative"
                    aria-label="Hapus note"
                    onClick={() => {
                      if (confirm("Hapus named note ini?"))
                        update(notes.filter((n) => n.id !== note.id));
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ) : (
                <h3>{note.title}</h3>
              )}
              {!edit ? (
                <Markdown body={note.body} />
              ) : (
                <RichEditor
                  key={note.id}
                  label="Markdown note"
                  disabled={busy}
                  value={note.body}
                  onChange={(body) =>
                    update(
                      notes.map((n) => (n.id === note.id ? { ...n, body } : n)),
                    )
                  }
                />
              )}
            </>
          )}
        </div>
      </div>
      {changed && (
        <div className="unsaved-label">Perubahan belum disimpan.</div>
      )}
    </section>
  );
}
function Itinerary({ j, edit, busy, run, dirty }: ContentProps) {
  const [days, setDays] = useState<Day[]>(structuredClone(j.days)),
    [changed, setChanged] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  useEffect(() => {
    setDays(structuredClone(j.days));
    setChanged(false);
    dirty(false);
  }, [j.version]);
  function update(next: Day[]) {
    setDays(next);
    setChanged(true);
    dirty(true, { days: next });
  }
  function updateItem(
    day: string,
    id: string,
    key: "name" | "description",
    value: string,
  ) {
    update(
      days.map((d) =>
        d.id !== day
          ? d
          : {
              ...d,
              items: d.items.map((i) =>
                i.id !== id ? i : { ...i, [key]: value },
              ),
            },
      ),
    );
  }
  function move(id: string, destination: string, position: number) {
    const next = structuredClone(days);
    let item: Day["items"][number] | undefined;
    for (const d of next) {
      const at = d.items.findIndex((i) => i.id === id);
      if (at !== -1) {
        [item] = d.items.splice(at, 1);
        break;
      }
    }
    const day = next.find((d) => d.id === destination);
    if (item && day) {
      day.items.splice(
        Math.min(Math.max(position, 0), day.items.length),
        0,
        item,
      );
      update(next);
    }
  }
  function drop(e: DragEndEvent) {
    if (!e.over) return;
    const target = String(e.over.id);
    const day = days.find(
      (d) => d.id === target || d.items.some((i) => i.id === target),
    );
    if (day)
      move(
        String(e.active.id),
        day.id,
        day.items.findIndex((i) => i.id === target) < 0
          ? day.items.length
          : day.items.findIndex((i) => i.id === target),
      );
  }
  const duration =
    j.start && j.end
      ? Math.round((Date.parse(j.end) - Date.parse(j.start)) / 86400000) + 1
      : 0;
  const mismatch = j.kind === "trip" && duration < days.length;
  return (
    <section className="spaced-panel">
      <div className="section-toolbar">
        <div>
          <h2>{j.kind === "lead" ? "Itinerary Draft" : "Itinerary"}</h2>
          <p>Day-stacked planning · Name & Description</p>
        </div>
        <div className="row-actions">
          {edit && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  update([
                    ...days,
                    { id: crypto.randomUUID(), title: "", items: [] },
                  ])
                }
              >
                <Plus size={15} />
                Tambah day
              </Button>
              <Button
                size="sm"
                disabled={!changed || busy}
                onClick={async () => {
                  if (
                    await run({
                      action: "content",
                      id: j.id,
                      version: j.version,
                      data: { days },
                    })
                  ) {
                    setChanged(false);
                    dirty(false);
                  }
                }}
              >
                <Save size={14} />
                Simpan itinerary
              </Button>
              {changed && <CopyChanges value={days} />}
            </>
          )}
        </div>
      </div>
      {mismatch && (
        <div className="notice warning">
          Itinerary memiliki {days.length} day, tetapi durasi trip {duration}{" "}
          hari. Konten tetap tersimpan; sharing diblokir sampai mismatch
          diselesaikan.
        </div>
      )}
      <DndContext sensors={sensors} onDragEnd={drop}>
        {days.map((day, di) => (
          <DaySection
            key={day.id}
            day={day}
            index={di}
            j={j}
            edit={edit}
            days={days}
            onTitle={(v) =>
              update(
                days.map((d) => (d.id === day.id ? { ...d, title: v } : d)),
              )
            }
            onDelete={() => {
              if (days.length <= 1) return;
              if (
                !day.items.length ||
                confirm("Hapus day ini beserta seluruh item?")
              )
                update(days.filter((d) => d.id !== day.id));
            }}
            onAdd={() =>
              update(
                days.map((d) =>
                  d.id === day.id
                    ? {
                        ...d,
                        items: [
                          ...d.items,
                          {
                            id: crypto.randomUUID(),
                            name: "Aktivitas baru",
                            description: "",
                          },
                        ],
                      }
                    : d,
                ),
              )
            }
            onItem={updateItem}
            onMove={move}
            onRemove={(id) => {
              if (confirm("Hapus item itinerary?"))
                update(
                  days.map((d) => ({
                    ...d,
                    items: d.items.filter((i) => i.id !== id),
                  })),
                );
            }}
          />
        ))}
      </DndContext>
      {changed && (
        <div className="unsaved-label">
          Perubahan belum disimpan. Drag atau Move Up/Down/To Day tersedia.
        </div>
      )}
    </section>
  );
}
function DaySection({
  day,
  index,
  j,
  edit,
  days,
  onTitle,
  onDelete,
  onAdd,
  onItem,
  onMove,
  onRemove,
}: {
  day: Day;
  index: number;
  j: Journey;
  edit: boolean;
  days: Day[];
  onTitle: (v: string) => void;
  onDelete: () => void;
  onAdd: () => void;
  onItem: (d: string, i: string, k: "name" | "description", v: string) => void;
  onMove: (id: string, dest: string, pos: number) => void;
  onRemove: (i: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day.id });
  const dayDate = j.start
    ? new Date(Date.parse(j.start) + index * 86400000)
        .toISOString()
        .slice(0, 10)
    : "";
  return (
    <section
      ref={setNodeRef}
      className={"itinerary-day panel " + (isOver ? "drop-active" : "")}
    >
      <header className="day-heading">
        <span className="day-number">{String(index + 1).padStart(2, "0")}</span>
        <div>
          <b>Day {index + 1}</b>
          <small>
            {dayDate ? shortDate(dayDate) : "Draft · tanggal fleksibel"}
          </small>
        </div>
        {edit ? (
          <input
            aria-label={`Judul Day ${index + 1}`}
            placeholder="Judul day (opsional)"
            value={day.title}
            onChange={(e) => onTitle(e.target.value)}
          />
        ) : (
          <span>{day.title}</span>
        )}
        {edit && (
          <button
            className="icon-button negative"
            disabled={days.length <= 1}
            aria-label={`Hapus Day ${index + 1}`}
            onClick={onDelete}
          >
            <Trash2 size={15} />
          </button>
        )}
      </header>
      <div className="itinerary-columns">
        <b>Name</b>
        <b>Description</b>
      </div>
      {day.items.map((i, position) => (
        <ItineraryRow
          key={i.id}
          item={i}
          day={day}
          days={days}
          position={position}
          edit={edit}
          onChange={(key, v) => onItem(day.id, i.id, key, v)}
          onMove={onMove}
          onRemove={() => onRemove(i.id)}
        />
      ))}
      {!day.items.length && (
        <div className="empty-day">Belum ada aktivitas untuk day ini.</div>
      )}
      {edit && (
        <button className="add-item" onClick={onAdd}>
          <Plus size={14} />
          Tambah aktivitas
        </button>
      )}
    </section>
  );
}
function ItineraryRow({
  item,
  day,
  days,
  position,
  edit,
  onChange,
  onMove,
  onRemove,
}: {
  item: Day["items"][number];
  day: Day;
  days: Day[];
  position: number;
  edit: boolean;
  onChange: (k: "name" | "description", v: string) => void;
  onMove: (id: string, dest: string, pos: number) => void;
  onRemove: () => void;
}) {
  const drag = useDraggable({ id: item.id, disabled: !edit }),
    drop = useDroppable({ id: item.id });
  return (
    <div
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      className={"itinerary-row " + (drag.isDragging ? "dragging" : "")}
      style={
        drag.transform
          ? {
              transform: `translate(${drag.transform.x}px,${drag.transform.y}px)`,
            }
          : undefined
      }
    >
      <div className="item-name">
        {edit && (
          <button
            className="drag-icon"
            {...drag.listeners}
            {...drag.attributes}
            aria-label={`Drag ${item.name}`}
          >
            <GripVertical size={16} />
          </button>
        )}
        {edit ? (
          <input
            value={item.name}
            aria-label="Activity name"
            onChange={(e) => onChange("name", e.target.value)}
          />
        ) : (
          <b>{item.name}</b>
        )}
      </div>
      <div>
        {edit ? (
          <RichEditor
            value={item.description}
            label="Activity description"
            onChange={(value) => onChange("description", value)}
          />
        ) : (
          <Markdown body={item.description} />
        )}
        <div className="item-actions">
          {edit && (
            <>
              <button
                disabled={position === 0}
                aria-label="Move up"
                onClick={() => onMove(item.id, day.id, position - 1)}
              >
                <ArrowUp size={13} />
              </button>
              <button
                disabled={position === day.items.length - 1}
                aria-label="Move down"
                onClick={() => onMove(item.id, day.id, position + 1)}
              >
                <ArrowDown size={13} />
              </button>
              <select
                aria-label="Move to day"
                value={day.id}
                onChange={(e) => onMove(item.id, e.target.value, 9999)}
              >
                {days.map((d, i) => (
                  <option key={d.id} value={d.id}>
                    Day {i + 1}
                  </option>
                ))}
              </select>
              <button aria-label="Hapus aktivitas" onClick={onRemove}>
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function Contacts({ j, edit, busy, run, dirty }: ContentProps) {
  const [contacts, setContacts] = useState<Contact[]>(
      structuredClone(j.contacts),
    ),
    [changed, setChanged] = useState(false);
  useEffect(() => {
    setContacts(structuredClone(j.contacts));
    setChanged(false);
    dirty(false);
  }, [j.version]);
  function update(next: Contact[]) {
    setContacts(next);
    setChanged(true);
    dirty(true, { contacts: next });
  }
  return (
    <section className="panel spaced-panel">
      <div className="panel-heading">
        <div>
          <h2>Contacts</h2>
          <p>
            Kontak operasional dan klien · tidak menyimpan data
            paspor/pembayaran
          </p>
        </div>
        <div className="row-actions">
          {edit && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  update([
                    ...contacts,
                    {
                      id: crypto.randomUUID(),
                      name: "Kontak baru",
                      role: "",
                      organization: "",
                      phone: "",
                      email: "",
                      note: "",
                    },
                  ])
                }
              >
                <Plus size={15} />
                Contact
              </Button>
              <Button
                size="sm"
                disabled={!changed || busy}
                onClick={async () => {
                  if (
                    await run({
                      action: "content",
                      id: j.id,
                      version: j.version,
                      data: { contacts },
                    })
                  ) {
                    setChanged(false);
                    dirty(false);
                  }
                }}
              >
                <Save size={14} />
                Simpan contacts
              </Button>
              {changed && <CopyChanges value={contacts} />}
            </>
          )}
        </div>
      </div>
      <div className="contacts-grid">
        {contacts.map((c) => (
          <article className="contact-card" key={c.id}>
            {edit ? (
              <>
                <div className="contact-top">
                  <strong>Contact</strong>
                  <button
                    className="icon-button"
                    aria-label="Hapus contact"
                    onClick={() => {
                      if (confirm("Hapus contact ini?"))
                        update(contacts.filter((x) => x.id !== c.id));
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="form-grid">
                  {(
                    ["name", "role", "organization", "phone", "email"] as const
                  ).map((key) => (
                    <label key={key}>
                      {
                        {
                          name: "Nama *",
                          role: "Role",
                          organization: "Organisasi",
                          phone: "Telepon",
                          email: "Email",
                        }[key]
                      }
                      <input
                        type={key === "email" ? "email" : "text"}
                        value={c[key]}
                        onChange={(e) =>
                          update(
                            contacts.map((x) =>
                              x.id === c.id
                                ? { ...x, [key]: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Internal note
                  <textarea
                    value={c.note}
                    onChange={(e) =>
                      update(
                        contacts.map((x) =>
                          x.id === c.id ? { ...x, note: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </label>
              </>
            ) : (
              <>
                <span className="avatar">{initials(c.name)}</span>
                <h3>{c.name}</h3>
                <p>
                  {c.role} {c.organization && `· ${c.organization}`}
                </p>
                {c.phone && (
                  <p>
                    <Phone size={14} />
                    {c.phone}
                  </p>
                )}
                {c.email && (
                  <p>
                    <Mail size={14} />
                    {c.email}
                  </p>
                )}
                <p>{c.note}</p>
              </>
            )}
          </article>
        ))}
      </div>
      {!contacts.length && (
        <div className="empty-state small">
          <Users size={23} />
          <p>Belum ada contact.</p>
        </div>
      )}
      {changed && (
        <div className="unsaved-label">Perubahan belum disimpan.</div>
      )}
    </section>
  );
}
function TripFinance({
  j,
  s,
  open,
}: {
  j: Journey;
  s: Snapshot;
  open: (e: Editor) => void;
}) {
  const [data, setData] = useState(s),
    [filters, setFilters] = useState<Filters>({ status: "posted" }),
    [appliedFilters, setAppliedFilters] = useState<Filters>({
      status: "posted",
    }),
    [loading, setLoading] = useState(true),
    [hasLoaded, setHasLoaded] = useState(false),
    [error, setError] = useState("");
  const sequence = useRef(0);
  useEffect(() => {
    const seq = ++sequence.current;
    setLoading(true);
    const q = new URLSearchParams({
      timezone: localTimezone(),
      view: "trips",
      id: j.id,
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    });
    fetch("/api/workspace?" + q, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (seq !== sequence.current) return;
        if (!r.ok) throw Error(d.error);
        setData(d);
        setHasLoaded(true);
        setAppliedFilters(filters);
        setError("");
      })
      .catch((e) => {
        if (seq !== sequence.current) return;
        setError(e.message);
        setData({
          ...s,
          transactions: [],
          categories: [],
          cashRows: [],
          totals: { moneyIn: "0", moneyOut: "0", net: "0" },
        });
      })
      .finally(() => {
        if (seq === sequence.current) setLoading(false);
      });
    return () => {
      sequence.current++;
    };
  }, [j.id, JSON.stringify(filters), JSON.stringify(s.transactions)]);
  return (
    <>
      <div className="section-toolbar">
        <h2>Kas Trip · satu ledger</h2>
        {can(s.user, "finance", true) && (
          <div className="row-actions">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                open({ kind: "transaction", journey: j, direction: "out" })
              }
            >
              Money Out
            </Button>
            <Button
              size="sm"
              onClick={() =>
                open({ kind: "transaction", journey: j, direction: "in" })
              }
            >
              <Plus size={14} />
              Money In
            </Button>
          </div>
        )}
      </div>
      <div className="finance-filters">
        <label>
          Dari
          <input
            type="date"
            value={filters.from || ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, from: e.target.value, page: "0" }))
            }
          />
        </label>
        <label>
          Sampai
          <input
            type="date"
            value={filters.to || ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, to: e.target.value, page: "0" }))
            }
          />
        </label>
        <select
          aria-label="Status transaksi"
          value={filters.status}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: e.target.value }))
          }
        >
          <option value="posted">Posted</option>
          <option value="void">Void</option>
          <option value="all">Semua status</option>
        </select>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setFilters({ status: "posted" })}
        >
          All time
        </Button>
      </div>
      {error && <div className="error-box">{error}</div>}
      {loading && (
        <div className="notice" role="status">
          Memuat kas terbaru; periode di bawah mengikuti data terakhir yang
          berhasil dimuat.
        </div>
      )}
      {!error && hasLoaded && (
        <>
          <CashStats s={data} period={periodLabel(appliedFilters)} />
          <Ledger
            s={data}
            canEdit={can(s.user, "finance", true)}
            onEdit={open}
          />
          <Pagination
            count={data.count}
            page={Number(appliedFilters.page || 0)}
            onPage={(p) => setFilters((f) => ({ ...f, page: String(p) }))}
          />
        </>
      )}
      <div className="notice">
        Transaksi Trip tetap tersimpan saat completed, cancelled, atau archived.
        Hasil kas bukan profit akuntansi.
      </div>
    </>
  );
}
