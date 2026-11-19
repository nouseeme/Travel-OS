"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ShareAction = "status" | "create" | "revoke";

async function requestShare(
  action: ShareAction,
  journeyId: string,
  noteId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const response = await fetch("/api/note-shares", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, journeyId, noteId }),
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Link note tidak tersedia.");
  return data.url;
}

export function NoteSharing({
  journeyId,
  noteId,
  canCreate,
  disabled,
}: {
  journeyId: string;
  noteId: string;
  canCreate: boolean;
  disabled: boolean;
}) {
  const [url, setUrl] = useState<string | null>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showUrl, setShowUrl] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    requestShare("status", journeyId, noteId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setUrl(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Gagal memuat link note.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [journeyId, noteId]);

  async function manage(action: ShareAction) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      setUrl(await requestShare(action, journeyId, noteId));
      setShowUrl(false);
      if (action === "create") setMessage("Link baca-saja dibuat.");
      if (action === "revoke") setMessage("Link dicabut.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal mengubah link.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!url) return;
    setMessage("");
    setError("");
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link disalin.");
    } catch {
      setShowUrl(true);
    }
  }

  return (
    <>
      <div className="row-actions note-share-actions" aria-busy={loading}>
        {url ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={copy}
            >
              Salin link
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={loading}
              onClick={() => manage("revoke")}
            >
              Unshare
            </Button>
          </>
        ) : url === null && canCreate ? (
          <Button
            size="sm"
            variant="outline"
            disabled={loading || disabled}
            onClick={() => manage("create")}
          >
            Buat link baca-saja
          </Button>
        ) : url === undefined && !loading ? (
          <Button size="sm" variant="outline" onClick={() => manage("status")}>
            Muat ulang link
          </Button>
        ) : null}
        {message && <span role="status">{message}</span>}
        {error && <span role="alert">{error}</span>}
      </div>
      {url && showUrl && (
        <input
          aria-label="Link baca-saja"
          value={url}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </>
  );
}
