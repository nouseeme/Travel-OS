"use client";
import { useEffect, useState } from "react";
import type { Command, InternalDoc, Snapshot } from "@/lib/model";
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
}: {
  s: Snapshot;
  document?: InternalDoc;
  run: (c: Command) => Promise<boolean>;
  busy: boolean;
  navigate: (url: string) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const editable = can(s.user, "docs", true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState(document?.title || "");
  const [date, setDate] = useState(document?.date || s.today);
  const [category, setCategory] = useState(document?.category || "General");
  const [body, setBody] = useState(document?.body || "");
  const [dirty, setDirty] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [mode, setMode] = useState("edit");
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
            <select
              aria-label="Mode dokumen"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="edit">{editable ? "Edit" : "View"}</option>
              <option value="view">View / read</option>
            </select>
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
        <table>
          <thead>
            <tr>
              <th>Judul</th>
              <th>Date</th>
              <th>Creator</th>
              <th>Category</th>
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
        </table>
        {!s.documents?.length && (
          <div className="empty-state">Belum ada dokumen.</div>
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
