"use client";
import { useEffect, useState } from "react";
import type { Journey } from "@/lib/model";
import { Button } from "./ui/button";
import { Markdown } from "./markdown";
import { localTimestamp } from "@/lib/time";
export function Sharing({ j }: { j: Journey }) {
  const [selection, setSelection] = useState({
    title: "",
    notes: [] as string[],
    contacts: [] as string[],
    dates: false,
    itinerary: false,
  });
  const [preview, setPreview] = useState<any>(null),
    [links, setLinks] = useState<any[]>([]),
    [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [url, setUrl] = useState(""),
    [days, setDays] = useState(7);
  async function call(action: string, link?: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          trip: j.id,
          version: j.version,
          selection,
          link,
          days,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (action === "list") {
        setLinks(d.links);
        setEnabled(d.enabled);
      } else if (action === "preview") setPreview(d);
      else {
        if (d.url) setUrl(d.url);
        await load();
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    const r = await fetch("/api/shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list", trip: j.id }),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setLinks(d.links);
    setEnabled(d.enabled);
  }
  useEffect(() => {
    let active = true;
    load().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [j.id]);
  useEffect(() => {
    setPreview(null);
  }, [JSON.stringify(selection), j.version]);
  const toggle = (key: "notes" | "contacts", id: string) =>
    setSelection((x) => ({
      ...x,
      [key]: x[key].includes(id)
        ? x[key].filter((v) => v !== id)
        : [...x[key], id],
    }));
  return (
    <section className="p1-panel">
      <h2>Read-only snapshot sharing</h2>
      <p>
        Default tidak ada konten terpilih. Notes terpilih dipublish utuh; hapus
        informasi rahasia sebelum publish. Contact notes internal dan Finance
        selalu dikecualikan.
      </p>
      {!enabled && (
        <div className="notice">
          Preview tersedia. Publish tetap disabled sampai deployed security gate
          lulus.
        </div>
      )}
      <div className="template-form">
        <label>
          Judul publik
          <input
            maxLength={200}
            value={selection.title}
            onChange={(e) =>
              setSelection({ ...selection, title: e.target.value })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={selection.dates}
            onChange={(e) =>
              setSelection({ ...selection, dates: e.target.checked })
            }
          />
          Tanggal Trip
        </label>
        <label>
          <input
            type="checkbox"
            checked={selection.itinerary}
            onChange={(e) =>
              setSelection({ ...selection, itinerary: e.target.checked })
            }
          />
          Itinerary
        </label>
        <fieldset>
          <legend>Named notes</legend>
          {j.notes.map((n) => (
            <label key={n.id}>
              <input
                type="checkbox"
                checked={selection.notes.includes(n.id)}
                onChange={() => toggle("notes", n.id)}
              />
              {n.title}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Contacts</legend>
          {j.contacts.map((c) => (
            <label key={c.id}>
              <input
                type="checkbox"
                checked={selection.contacts.includes(c.id)}
                onChange={() => toggle("contacts", c.id)}
              />
              {c.name}
            </label>
          ))}
        </fieldset>
        <label>
          Expiry (hari, maksimal 30)
          <input
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </label>
        <Button
          disabled={busy}
          variant="outline"
          onClick={() => call("preview")}
        >
          Preview snapshot
        </Button>
        {error && (
          <div className="notice" role="alert">
            {error}
          </div>
        )}
        {preview && (
          <>
            <article className="share-preview">
              <h2>{preview.title || "Trip information"}</h2>
              {preview.start && (
                <p>
                  {preview.start}–{preview.end}
                </p>
              )}
              {preview.notes.map((n: any, i: number) => (
                <section key={i}>
                  <h3>{n.title}</h3>
                  <Markdown body={n.body} />
                </section>
              ))}
              {preview.days?.map((d: any, i: number) => (
                <section key={i}>
                  <h3>
                    Day {i + 1} · {d.title}
                  </h3>
                  {d.items.map((it: any, k: number) => (
                    <div key={k}>
                      <b>{it.name}</b>
                      <p>{it.description}</p>
                    </div>
                  ))}
                </section>
              ))}
              {preview.contacts.map((c: any, i: number) => (
                <section key={i}>
                  <h3>{c.name}</h3>
                  <p>
                    {c.role} · {c.organization}
                  </p>
                  <p>
                    {c.phone} · {c.email}
                  </p>
                </section>
              ))}
            </article>
            <p>
              Bearer link dapat diteruskan. Revoke tidak menarik kembali
              screenshot atau salinan.
            </p>
            <Button
              disabled={busy || !enabled}
              onClick={() => {
                if (
                  confirm(
                    "Publish konten persis seperti preview untuk pemegang link?",
                  )
                )
                  void call("create");
              }}
            >
              Publish new link
            </Button>
          </>
        )}
        {url && (
          <div className="notice">
            <label>
              Link baru — salin sekarang
              <input readOnly value={url} onFocus={(e) => e.target.select()} />
            </label>
          </div>
        )}
      </div>
      <h3>Existing links</h3>
      {links.map((l) => (
        <div className="configuration-row" key={l.id}>
          <span>
            {l.revoked_at
              ? "Revoked"
              : new Date(l.expires_at) < new Date()
                ? "Expired"
                : "Active"}{" "}
            · {localTimestamp(l.expires_at)}
          </span>
          {!l.revoked_at && (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (confirm("Revoke link ini?")) void call("revoke", l.id);
                }}
              >
                Revoke
              </Button>
              <Button
                variant="outline"
                disabled={busy || !enabled || !preview}
                onClick={() => {
                  if (confirm("Publish preview sebagai snapshot terbaru?"))
                    void call("publish", l.id);
                }}
              >
                Publish update
              </Button>
              <Button
                variant="outline"
                disabled={busy || !enabled || !preview}
                onClick={() => {
                  if (confirm("Regenerate link dan cabut link sebelumnya?"))
                    void call("regenerate", l.id);
                }}
              >
                Regenerate
              </Button>
            </>
          )}
        </div>
      ))}
    </section>
  );
}
