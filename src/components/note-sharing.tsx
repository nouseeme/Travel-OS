"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, RefreshCw, Unlink2 } from "lucide-react";

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
  const [copied, setCopied] = useState(false);
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
    setCopied(false);
    try {
      setUrl(await requestShare(action, journeyId, noteId));
      setShowUrl(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal mengubah link.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!url) return;
    setCopied(false);
    setError("");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setShowUrl(false);
    } catch {
      setShowUrl(true);
    }
  }

  const retry = url === undefined && !loading;
  const label = url
    ? "Unshare"
    : retry
      ? "Muat ulang link"
      : "Buat link baca-saja";

  return (
    <>
      {(url || (url === null && canCreate) || retry) && (
        <button
          type="button"
          className="icon-button"
          aria-label={label}
          title={label}
          disabled={loading || (!url && !retry && disabled)}
          onClick={() => manage(url ? "revoke" : retry ? "status" : "create")}
        >
          {url ? (
            <Unlink2 size={15} />
          ) : retry ? (
            <RefreshCw size={15} />
          ) : (
            <Link2 size={15} />
          )}
        </button>
      )}
      {url && (
        <button
          type="button"
          className="icon-button"
          aria-label="Salin link"
          title={copied ? "Link disalin" : "Salin link"}
          disabled={loading}
          onClick={copy}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      )}
      <span role="status" className="sr-only">
        {copied && "Link disalin."}
      </span>
      {error && (
        <span role="alert" className="note-share-feedback">
          {error}
        </span>
      )}
      {url && showUrl && (
        <input
          className="note-share-feedback"
          aria-label="Link baca-saja"
          value={url}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </>
  );
}
