"use client";
import { SelectionTable } from "./selection-table";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import type { Command, InternalDoc, Snapshot, Filters } from "@/lib/model";
import { can, shortDate } from "@/lib/format";
import { Button } from "./ui/button";
import { RichEditor } from "./rich-editor";
import { Markdown } from "./markdown";
import { Modal } from "./ui/dialog";
import { DocSharing } from "./doc-sharing";
import { ClickableRow } from "./clickable-row";

export function InternalDocs({
  s,
  document,
  run,
  busy,
  navigate,
  onDirty,
  filters = {},
  onFilter,
}: {
  s: Snapshot;
  document?: InternalDoc;
  run: (c: Command) => Promise<boolean>;
  busy: boolean;
  navigate: (url: string) => void;
  onDirty: (dirty: boolean) => void;
  filters?: Filters;
  onFilter?: (key: keyof Filters, value: string) => void;
}) {
  const editable = can(s.user, "docs", true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState(document?.title || "");
  const [date, setDate] = useState(document?.date || s.today);
  const [category, setCategory] = useState(document?.category || "General");
  const [body, setBody] = useState(document?.body || "");
  const [dirty, setDirty] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [mode, setMode] = useState("view");
  useEffect(() => {
    if (!dirty && document) {
      setTitle(document.title);
      setDate(document.date);
      setCategory(document.category);
      setBody(document.body);
    }
  }, [document?.version, dirty]);
  const change = () => {
    setDirty(true);
    onDirty(true);
  };
  const templates =
    s.templates?.filter(
      (t) =>
        t.active && t.kind === "internal_doc" && typeof t.content === "string",
    ) || [];
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (
      await run({
        action: document ? "update_doc" : "create_doc",
        id: document?.id,
        version: document?.version,
        data: { title, date, category, body },
      })
    ) {
      setDirty(false);
      onDirty(false);
      setCreating(false);
      setMode("view");
    }
  }
  const fields = (
    <>
      <fieldset className="form-grid doc-fields" disabled={busy}>
        <label>
          Judul *
          <input
            required
            maxLength={200}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              change();
            }}
          />
        </label>
        <label>
          Date *
          <input
            type="date"
            required
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              change();
            }}
          />
        </label>
        <label>
          Category *
          <input
            required
            maxLength={100}
            list="doc-categories"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              change();
            }}
          />
          <datalist id="doc-categories">
            <option>General</option>
            <option>SOP</option>
            <option>Meeting notes</option>
            <option>Policy</option>
            <option>Knowledge base</option>
          </datalist>
        </label>
      </fieldset>
      <label>
        Template
        <select
          disabled={busy}
          defaultValue=""
          onChange={(e) => {
            const template = templates.find((t) => t.id === e.target.value);
            if (
              template &&
              (!body || confirm("Ganti isi dokumen dengan template ini?"))
            ) {
              setBody(String(template.content));
              change();
            }
            e.target.value = "";
          }}
        >
          <option value="">Pilih template…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <RichEditor
        disabled={busy}
        value={body}
        onChange={(v) => {
          setBody(v);
          change();
        }}
        label="Isi dokumen"
      />
      <div className="row-actions">
        <Button disabled={busy || !title.trim() || !category.trim()}>
          Simpan dokumen
        </Button>
        {dirty && <small>Perubahan belum disimpan</small>}
      </div>
    </>
  );
  if (document)
    return (
      <>
        <button className="back-link" onClick={() => navigate("/docs")}>
          ← Internal Docs
        </button>
        <div className="detail-heading">
          <div>
            <h1>{document.title}</h1>
            <p>
              {shortDate(document.date)} ·{" "}
              {s.people.find((p) => p.id === document.creator)?.name} ·{" "}
              {document.category}
            </p>
          </div>
          <div className="row-actions">
            {editable && mode === "view" && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setMode("edit")}
              >
                Edit
              </Button>
            )}
            {editable && mode === "edit" && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (dirty && !confirm("Buang perubahan dokumen?")) return;
                  setTitle(document.title);
                  setDate(document.date);
                  setCategory(document.category);
                  setBody(document.body);
                  setDirty(false);
                  onDirty(false);
                  setMode("view");
                }}
              >
                Batal
              </Button>
            )}
            {editable && (
              <Button
                variant="outline"
                disabled={dirty || busy}
                onClick={() => setSharing((v) => !v)}
              >
                Share · View only
              </Button>
            )}
          </div>
        </div>
        {sharing && <DocSharing doc={document} />}
        {editable && mode === "edit" ? (
          <form className="doc-editor modal-form" onSubmit={save}>
            {fields}
          </form>
        ) : (
          <article className="doc-editor">
            <Markdown body={body} />
          </article>
        )}
        {dirty && (
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(body);
            }}
          >
            Copy changes
          </Button>
        )}
      </>
    );
  return (
    <>
      <div className="section-toolbar">
        <h2>Internal Docs</h2>
        {editable && (
          <Button
            onClick={() => {
              setTitle("");
              setDate(s.today);
              setCategory("General");
              setBody("");
              setCreating(true);
            }}
          >
            + Dokumen baru
          </Button>
        )}
      </div>
      <div className="table-wrap docs-table">
        <SelectionTable
          onDelete={
            editable
              ? async (ids) =>
                  run({
                    action: "delete_docs",
                    data: {
                      records: (s.documents || [])
                        .filter((d) => ids.includes(d.id))
                        .map((d) => ({ id: d.id, version: d.version })),
                    },
                  })
              : undefined
          }
        >
          <thead>
            <tr>
              {(
                [
                  ["title", "Judul"],
                  ["date", "Date"],
                  ["creator", "Creator"],
                  ["category", "Category"],
                ] as const
              ).map(([key, label]) => (
                <DocColumn
                  key={key}
                  column={key}
                  label={label}
                  filters={filters}
                  onFilter={onFilter}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {s.documents?.map((d) => (
              <ClickableRow
                key={d.id}
                label={`Buka dokumen ${d.title}`}
                onOpen={() => navigate("/docs/" + d.id)}
              >
                <td>
                  <button
                    className="table-link"
                    onClick={() => navigate("/docs/" + d.id)}
                  >
                    {d.title}
                  </button>
                </td>
                <td>{shortDate(d.date)}</td>
                <td>{s.people.find((p) => p.id === d.creator)?.name || "—"}</td>
                <td>
                  <span className="tag neutral">{d.category}</span>
                </td>
              </ClickableRow>
            ))}
          </tbody>
        </SelectionTable>
        {!s.documents?.length && (
          <div className="empty-state">
            {s.count
              ? "Tidak ada dokumen di halaman ini."
              : "Tidak ada dokumen yang cocok."}
          </div>
        )}
      </div>
      {creating && (
        <Modal
          open
          title="Dokumen baru"
          onClose={() => {
            if (!busy && (!dirty || confirm("Buang perubahan dokumen?"))) {
              setCreating(false);
              setDirty(false);
              onDirty(false);
            }
          }}
        >
          <form className="modal-form" onSubmit={save}>
            {fields}
          </form>
        </Modal>
      )}
    </>
  );
}

function DocColumn({
  column,
  label,
  filters,
  onFilter,
}: {
  column: NonNullable<Filters["sort"]>;
  label: string;
  filters: Filters;
  onFilter?: (key: keyof Filters, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (
        !anchor.current?.contains(e.target as Node) &&
        !menu.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        anchor.current?.focus();
      }
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  const active =
    column === "date"
      ? Boolean(filters.from || filters.to)
      : Boolean(filters[column]);
  const sort = filters.sort || "date",
    order = filters.order || "desc";
  return (
    <th
      aria-sort={
        sort === column
          ? order === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        ref={anchor}
        type="button"
        className={`column-toggle ${active ? "filtered" : ""}`}
        aria-label={`Kolom ${label}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <span aria-hidden="true">
          {sort === column ? (order === "asc" ? " ↑" : " ↓") : " ≡"}
          {active ? " •" : ""}
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            role="dialog"
            aria-label={`Pengaturan kolom ${label}`}
            className="column-menu"
            style={{
              position: "fixed",
              top: Math.min(
                anchor.current?.getBoundingClientRect().bottom || 0,
                window.innerHeight - 340,
              ),
              left: Math.max(
                8,
                Math.min(
                  anchor.current?.getBoundingClientRect().left || 0,
                  window.innerWidth - 264,
                ),
              ),
            }}
          >
            <b>{label}</b>
            <div className="row-actions">
              {(["asc", "desc"] as const).map((direction) => (
                <Button
                  type="button"
                  key={direction}
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onFilter?.("sort", column);
                    onFilter?.("order", direction);
                    setOpen(false);
                  }}
                >
                  {direction === "asc" ? "Urut naik ↑" : "Urut turun ↓"}
                </Button>
              ))}
            </div>
            {column === "date" ? (
              <>
                <label>
                  Dari
                  <input
                    aria-label="Filter Date dari"
                    type="date"
                    value={filters.from || ""}
                    onChange={(e) => onFilter?.("from", e.target.value)}
                  />
                </label>
                <label>
                  Sampai
                  <input
                    aria-label="Filter Date sampai"
                    type="date"
                    value={filters.to || ""}
                    onChange={(e) => onFilter?.("to", e.target.value)}
                  />
                </label>
              </>
            ) : (
              <label>
                Berisi
                <input
                  autoFocus
                  aria-label={`Filter ${label}`}
                  placeholder={`Cari ${label.toLowerCase()}…`}
                  value={filters[column] || ""}
                  onChange={(e) => onFilter?.(column, e.target.value)}
                />
              </label>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                if (column === "date") {
                  onFilter?.("from", "");
                  onFilter?.("to", "");
                } else onFilter?.(column, "");
                setOpen(false);
              }}
            >
              Hapus filter
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Tutup
            </Button>
          </div>,
          document.body,
        )}
    </th>
  );
}
