"use client";
import { useEffect, useState } from "react";
import type { Journey } from "@/lib/model";
import {
  shareTabs,
  defaultTripPermissions,
  type TripPermissions,
} from "@/lib/trip-sharing";
import { Button } from "./ui/button";
import { localTimestamp } from "@/lib/time";
import { Toast } from "./toast";
type Link = {
  id: string;
  version: number;
  permissions: TripPermissions;
  expires_at: string;
  revoked_at: string | null;
};
export function Sharing({ j }: { j: Journey }) {
  const [permissions, setPermissions] = useState<TripPermissions>({
    ...defaultTripPermissions,
  });
  const [links, setLinks] = useState<Link[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [url, setUrl] = useState(""),
    [days, setDays] = useState(7),
    [notice, setNotice] = useState("");
  async function call(action: string, link?: Link) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          trip: j.id,
          version: link?.version,
          permissions,
          link: link?.id,
          days,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw Error(d.error);
      if (action === "list") setLinks(d.links);
      else {
        if (d.url) setUrl(d.url);
        setNotice(
          action === "revoke"
            ? "Link dicabut."
            : "Pengaturan sharing tersimpan.",
        );
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
  }, [j.id]);
  return (
    <section className="panel spaced-panel">
      <div className="panel-heading">
        <div>
          <h2>Share Trip</h2>
          <p>
            Halaman Trip dengan data terbaru. Atur izin setiap tab untuk
            pemegang link.
          </p>
        </div>
      </div>
      <p className="muted">
        Tab yang dibuka menampilkan seluruh isinya, termasuk note kontak.
        Finance hanya menampilkan pengajuan dari link tersebut. Task yang
        terlihat hanya assignee Public.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tab</th>
              <th>Akses</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(shareTabs).map(([key, label]) => (
              <tr key={key}>
                <td>{label}</td>
                <td>
                  <select
                    aria-label={`Akses ${label}`}
                    value={permissions[key as keyof TripPermissions]}
                    onChange={(e) =>
                      setPermissions((p) => ({ ...p, [key]: e.target.value }))
                    }
                  >
                    <option value="none">Hidden</option>
                    <option value="view">Viewer</option>
                    <option value="edit">
                      Editor
                      {key === "finance" ? " · submit untuk approval" : ""}
                    </option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="section-toolbar">
        <label>
          Expiry (hari)
          <input
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </label>
        <Button
          disabled={busy || j.lifecycle !== "active"}
          onClick={() => void call("create")}
        >
          Buat link
        </Button>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {url && (
        <div className="doc-share-created">
          <label>
            Link baru · salin sekarang
            <input readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setNotice("Link disalin.");
              } catch {
                setError("Salin link secara manual.");
              }
            }}
          >
            Copy link
          </Button>
          <a href={url} target="_blank" rel="noreferrer">
            Buka halaman
          </a>
        </div>
      )}
      <h3>Existing links</h3>
      {links.map((l) => (
        <div className="doc-share-link" key={l.id}>
          <div>
            <b>
              {l.revoked_at
                ? "Revoked"
                : new Date(l.expires_at) < new Date()
                  ? "Expired"
                  : "Active"}
            </b>
            <small> · {localTimestamp(l.expires_at)}</small>
            <p>
              {Object.entries(l.permissions)
                .filter(([, v]) => v !== "none")
                .map(
                  ([k, v]) =>
                    `${shareTabs[k as keyof TripPermissions]}: ${v === "edit" ? "Editor" : "Viewer"}`,
                )
                .join(" · ")}
            </p>
          </div>
          {!l.revoked_at && (
            <div className="row-actions">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPermissions({ ...l.permissions })}
              >
                Muat izin
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void call("publish", l)}
              >
                Terapkan izin di atas
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void call("regenerate", l)}
              >
                Regenerate
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void call("revoke", l)}
              >
                Revoke
              </Button>
            </div>
          )}
        </div>
      ))}
      <p className="muted">
        Semua pemegang link memakai izin yang sama. Regenerate mencabut link
        sebelumnya; revoke menghentikan akses berikutnya.
      </p>
      {notice && <Toast message={notice} onClose={() => setNotice("")} />}
    </section>
  );
}
