"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Snapshot } from "@/lib/model";
import { localTimezone } from "@/lib/time";
type Option = { label: string; url: string };
export function BreadcrumbPicker({
  label,
  options,
  view,
  navigate,
}: {
  label: string;
  options?: Option[];
  view?: "sales" | "trips" | "docs";
  navigate: (url: string) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [rows, setRows] = useState<Option[]>([]),
    [count, setCount] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!open || !view) return;
    const abort = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        const q = new URLSearchParams({
          view,
          search,
          page: String(page),
          timezone: localTimezone(),
        });
        const r = await fetch("/api/workspace?" + q, {
          cache: "no-store",
          signal: abort.signal,
        });
        const d: Snapshot & { error?: string } = await r.json();
        if (!r.ok) throw Error(d.error || "Tidak dapat memuat daftar.");
        const next =
          view === "docs"
            ? (d.documents || []).map((x) => ({
                label: x.title,
                url: "/docs/" + x.id,
              }))
            : d.journeys.map((x) => ({
                label: x.name || x.client,
                url: "/" + view + "/" + x.id,
              }));
        setRows((prev) => (page ? [...prev, ...next] : next));
        setCount(d.count || 0);
      } catch (e) {
        if (!abort.signal.aborted) setError((e as Error).message);
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [open, view, search, page]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) ref.current!.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <details
      className="breadcrumb-picker"
      ref={ref}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          ref.current!.open = false;
          ref.current?.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label={view ? "Ganti trip atau project" : "Ganti modul"}>
        <span>{label}</span>
        <ChevronDown size={12} />
      </summary>
      <div className="breadcrumb-menu">
        {view && (
          <input
            autoFocus
            aria-label="Cari trip atau project"
            placeholder="Cari…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        )}
        {(options || rows).map((x) => (
          <button
            key={x.url}
            onClick={() => {
              ref.current!.open = false;
              navigate(x.url);
            }}
          >
            {x.label}
          </button>
        ))}
        {loading && <p role="status">Memuat…</p>}
        {error && <p role="alert">{error}</p>}
        {view && !loading && !error && !rows.length && <p>Belum ada record.</p>}
        {view && rows.length < count && (
          <button disabled={loading} onClick={() => setPage(page + 1)}>
            Lihat lainnya
          </button>
        )}
        {view && (
          <button
            className="breadcrumb-all"
            onClick={() => {
              ref.current!.open = false;
              navigate("/" + view);
            }}
          >
            Lihat semua
          </button>
        )}
      </div>
    </details>
  );
}
