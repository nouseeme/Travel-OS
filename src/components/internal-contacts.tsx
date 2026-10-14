"use client";
import { useState } from "react";
import type { Command, Snapshot } from "@/lib/model";
import { can } from "@/lib/format";
import { Contacts } from "./detail";
import { Button } from "./ui/button";

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
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const editable = can(s.user, "docs", true);
  const internal = s.internalContacts || { contacts: [], version: 1 };
  const directory = (s.contactDirectory || []).map((c, index) => ({
    ...c,
    id: `${c.source_kind}:${c.source_id || "internal"}:${c.id}:${index}`,
  }));
  const visible = directory.filter((c) =>
    [c.name, c.phone, c.email, c.note, c.source]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const sources = Object.fromEntries(
    directory.map((c) => [
      c.id,
      {
        label: c.source,
        url: c.source_id
          ? `/${c.source_kind === "lead" ? "sales" : "trips"}/${c.source_id}`
          : undefined,
      },
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
              onClick={() => setManaging((v) => !v)}
            >
              {managing ? "Tutup kontak internal" : "Kelola kontak internal"}
            </Button>
          )}
        </div>
      </div>
      {managing && (
        <Contacts
          j={{ id: s.user.id, ...internal }}
          edit={editable}
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
              data: { contacts },
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
        busy={busy}
        run={run}
        dirty={() => {}}
        sources={sources}
      />
    </>
  );
}
