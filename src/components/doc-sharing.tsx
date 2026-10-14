"use client";
import { useEffect, useState } from "react";
import type { InternalDoc } from "@/lib/model";
import { Button } from "./ui/button";
import { Markdown } from "./markdown";
import { localTimestamp } from "@/lib/time";
type Link = { id: string; expires_at: string; revoked_at: string | null };
export function DocSharing({ doc }: { doc: InternalDoc }) {
  const [links, setLinks] = useState<Link[]>([]),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [days, setDays] = useState(7),
    [preview, setPreview] = useState(false);
  async function call(action: string, link?: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          doc: doc.id,
          link,
          version: doc.version,
          days,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      if (action === "list") setLinks(data.links);
      else {
        if (data.url) setUrl(data.url);
        await call("list");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void call("list");
    setPreview(false);
  }, [doc.id, doc.version]);
  return (
    <section className="p1-panel doc-share">
      <header className="doc-share-heading">
        <h2>Share document</h2>
        <span className="tag neutral">View only</span>
      </header>
      <p className="doc-share-description">
        Siapa pun dengan link dapat membaca dokumen yang dipublish.
      </p>
      <small className="doc-share-hint">
        Edit terbaru dibagikan melalui Publish update.
      </small>
      <div className="doc-share-tools">
        <label>
          Berlaku
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>1 hari</option>
            <option value={7}>7 hari</option>
            <option value={30}>30 hari</option>
          </select>
        </label>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPreview((v) => !v)}
        >
          Preview
        </Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            if (
              confirm(
                "Bagikan seluruh isi dokumen ini melalui link hanya-baca?",
              )
            )
              void call("create");
          }}
        >
          Create view link
        </Button>
      </div>
      {preview && (
        <article className="share-preview">
          <h3>{doc.title}</h3>
          <Markdown body={doc.body} />
        </article>
      )}
      {url && (
        <label className="doc-share-created">
          View link
          <input readOnly value={url} onFocus={(e) => e.target.select()} />
          <Button
            variant="outline"
            onClick={() => navigator.clipboard.writeText(url)}
          >
            Copy link
          </Button>
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      {links.map((l) => (
        <div className="doc-share-link" key={l.id}>
          <div className="doc-share-link-info">
            <span className="tag neutral">
              {l.revoked_at
                ? "Revoked"
                : new Date(l.expires_at) <= new Date()
                  ? "Expired"
                  : "Active"}
            </span>
            <small>Berlaku hingga {localTimestamp(l.expires_at)}</small>
          </div>
          {!l.revoked_at && (
            <div className="doc-share-link-actions">
              <Button
                size="sm"
                variant="outline"
                disabled={busy || new Date(l.expires_at) <= new Date()}
                onClick={() => {
                  if (confirm("Publish isi dokumen terbaru ke link ini?"))
                    void call("publish", l.id);
                }}
              >
                Publish update
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (confirm("Cabut akses link ini?"))
                    void call("revoke", l.id);
                }}
              >
                Revoke
              </Button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
