"use client";
import { useState } from "react";
import type { Command, Snapshot, DirectoryContact, Contact } from "@/lib/model";
import { can } from "@/lib/format";
import { Contacts } from "./detail";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";

export function InternalContacts({
  s,
  run,
  busy,
  onDirty,
}: {
  s: Snapshot;
  run: (c: Command) => Promise<boolean>;
  busy: boolean;
  onDirty: (dirty: boolean) => void;
}) {
  const [managing, setManaging] = useState(false);
  const [newContact, setNewContact] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<DirectoryContact | null>(null);
  const editable = can(s.user, "docs", true);
  const internal = s.internalContacts || { contacts: [], version: 1 };
  const directory = s.contactDirectory || [];
  const visible = directory.filter((c) =>
    [c.name, c.phone, c.email, c.note, c.source]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const sources = Object.fromEntries(
    directory.map((c) => [
      c.id,
      (c.sources || [{ label: c.source, id: c.source_id, kind: c.source_kind }])
        .slice(0, 5)
        .map((source) => ({
          label: source.label,
          url: source.id
            ? `/${source.kind === "lead" ? "sales" : "trips"}/${source.id}`
            : undefined,
        })),
    ]),
  );
  return (
    <>
      <div className="section-toolbar">
        <h2>Contacts</h2>
        <div className="row-actions">
          {editable && (
            <Button
              variant="outline"
              disabled={busy || dirty}
              onClick={() => {
                setNewContact({
                  id: crypto.randomUUID(),
                  name: "",
                  phone: "",
                  email: "",
                  note: "",
                  role: "",
                  organization: "",
                });
                setManaging((v) => !v);
              }}
            >
              {managing ? "Tutup form kontak" : "Tambah kontak"}
            </Button>
          )}
        </div>
      </div>
      {managing && newContact && (
        <Contacts
          j={{
            id: s.user.id,
            version: internal.version,
            contacts: [newContact],
          }}
          edit={editable}
          initialEditing
          single
          busy={busy}
          run={run}
          dirty={(value) => {
            setDirty(value);
            onDirty(value);
          }}
          onSave={async (contacts) => {
            const saved = await run({
              action: "save_internal_contacts",
              version: internal.version,
              data: { contacts: [...internal.contacts, ...contacts] },
            });
            if (saved) setManaging(false);
            return saved;
          }}
        />
      )}
      <div className="internal-docs-toolbar">
        <label className="search-box internal-docs-search">
          <input
            aria-label="Cari contacts"
            placeholder="Cari nama, kontak, atau sumber…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <Contacts
        key={JSON.stringify(visible)}
        j={{ id: s.user.id, version: internal.version, contacts: visible }}
        edit={false}
        busy={busy || dirty}
        run={run}
        dirty={() => {}}
        sources={sources}
        onBulkDelete={
          editable
            ? async (ids) =>
                run({
                  action: "delete_contacts",
                  data: {
                    records: directory
                      .filter((c) => ids.includes(c.id))
                      .map((c) => ({ id: c.id, version: c.version })),
                  },
                })
            : undefined
        }
        onRowEdit={
          editable
            ? (c) => {
                const record = directory.find((x) => x.id === c.id);
                if (record) setSelected(record);
              }
            : undefined
        }
      />
      {selected && (
        <Modal
          open
          title={`Edit contact · ${selected.name}`}
          onClose={() => {
            if (busy || (dirty && !confirm("Buang perubahan contact?"))) return;
            setSelected(null);
            setDirty(false);
            onDirty(false);
          }}
        >
          <p>Perubahan berlaku di semua sumber yang memakai kontak ini.</p>
          <Contacts
            key={selected.id}
            j={{
              id: selected.id,
              version: selected.version || 1,
              contacts: [selected],
            }}
            edit
            initialEditing
            single
            busy={busy}
            run={run}
            dirty={(value) => {
              setDirty(value);
              onDirty(value);
            }}
            onSave={async (contacts) => {
              const c = contacts[0];
              if (!c) return false;
              const { id, name, phone, email, note, role, organization } = c;
              const saved = await run({
                action: "edit_contact",
                id: selected.id,
                version: selected.version,
                data: {
                  contact: { id, name, phone, email, note, role, organization },
                },
              });
              if (saved) {
                setSelected(null);
                setDirty(false);
                onDirty(false);
              }
              return saved;
            }}
          />
        </Modal>
      )}
    </>
  );
}
