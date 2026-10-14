"use client";
import { minorUnits, decimalString } from "@/lib/money";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type {
  Snapshot,
  Command,
  Filters,
  Template,
  Journey,
} from "@/lib/model";
import { moneyLabel, can } from "@/lib/format";
import { Button } from "./ui/button";
import { RichEditor } from "./rich-editor";
import { Toast } from "./toast";
import { TripPipeline, AuditDiff } from "./p2";
import { localTimezone, localTimestamp } from "@/lib/time";

function useInsights(
  mode: string,
  filters: Record<string, string | undefined>,
) {
  const [state, setState] = useState<{
    data: any;
    error: string;
    loading: boolean;
  }>({ data: null, error: "", loading: true });
  const key = JSON.stringify(filters);
  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, error: "", loading: true }));
    const q = new URLSearchParams({
      mode,
      timezone: localTimezone(),
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    } as Record<string, string>);
    fetch("/api/insights?" + q, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        if (!controller.signal.aborted)
          setState({ data, error: "", loading: false });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setState({ data: null, error: e.message, loading: false });
      });
    return () => controller.abort();
  }, [mode, key]);
  return state;
}
function Status({ state }: { state: { loading: boolean; error: string } }) {
  return state.loading ? (
    <Toast pending message="Memuat hasil terbaru..." />
  ) : state.error ? (
    <div role="alert" className="notice">
      {state.error}
    </div>
  ) : null;
}
export function Calendar({
  s,
  filters,
  navigate,
}: {
  s: Snapshot;
  filters: Filters;
  navigate: (url: string) => void;
}) {
  const [month, setMonth] = useState(s.today.slice(0, 7));
  const [year, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const from = month + "-01",
    to = month + "-" + String(last).padStart(2, "0");
  const state = useInsights("calendar", {
    from,
    to,
    pic: filters.pic,
    search: filters.search,
  });
  const rows = state.data?.rows || [];
  const shift = (n: number) =>
    setMonth(new Date(Date.UTC(year, m - 1 + n, 1)).toISOString().slice(0, 7));
  const offset = (new Date(from + "T00:00:00Z").getUTCDay() + 6) % 7;
  return (
    <section className="p1-panel">
      <div className="section-toolbar">
        <Button
          variant="outline"
          aria-label="Bulan sebelumnya"
          onClick={() => shift(-1)}
        >
          ←
        </Button>
        <label>
          Bulan{" "}
          <input
            type="month"
            value={month}
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value);
            }}
          />
        </label>
        <Button
          variant="outline"
          aria-label="Bulan berikutnya"
          onClick={() => shift(1)}
        >
          →
        </Button>
      </div>
      <Status state={state} />
      <p>
        Rentang perjalanan termasuk tanggal mulai dan selesai. Klik untuk
        membuka Trip.
      </p>
      <div
        className="calendar-scroll"
        role="region"
        aria-label="Kalender perjalanan"
        tabIndex={0}
      >
        <div className="calendar-grid">
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
            <b key={d}>{d}</b>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <div className="calendar-day blank" key={"blank" + i} />
          ))}
          {Array.from({ length: last }, (_, i) => {
            const date = month + "-" + String(i + 1).padStart(2, "0");
            return (
              <div
                className={"calendar-day " + (date === s.today ? "today" : "")}
                key={date}
              >
                <b>{i + 1}</b>
                {rows
                  .filter((r: any) => r.start <= date && r.end >= date)
                  .map((r: any) => (
                    <button
                      key={r.id}
                      onClick={() => navigate("/trips/" + r.id)}
                    >
                      {r.name}
                      <small>
                        {s.tripStages?.find((st) => st.id === r.stage)?.label ||
                          r.stage}
                      </small>
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      </div>
      {!state.loading && !state.error && !rows.length && (
        <p>Belum ada Trip pada bulan ini.</p>
      )}
    </section>
  );
}
export function SalesAnalytics({
  s,
  filters,
  navigate,
}: {
  s: Snapshot;
  filters: Filters;
  navigate: (url: string) => void;
}) {
  const state = useInsights("sales", {
    pic: filters.pic,
    from: filters.from,
    to: filters.to,
  });
  const rows: any[] = state.data?.rows || [],
    active = rows.filter((r) => r.lifecycle === "active");
  const st = s.salesStages?.filter((x) => x.active) || [];
  const prospect = st.find((x) => x.key === "prospect");
  const chart = st.map((x) => ({
    name: x.label,
    count: active.filter((r) => r.stage === x.id).length,
  }));
  return (
    <section className="p1-panel">
      <h2>Sales analytics</h2>
      <p>
        Filter PIC dan tanggal dibuat berlaku untuk semua angka. Distribusi ini
        bukan conversion rate.
      </p>
      <Status state={state} />
      {state.data && (
        <>
          <div className="p1-metrics">
            <div>
              Active <b>{active.length}</b>
            </div>
            <div>
              Prospect{" "}
              <b>
                {!prospect
                  ? "KPI nonaktif: stage Prospect retired"
                  : !active.length
                    ? "Belum ada lead"
                    : (
                        (100 *
                          active.filter((r) => r.stage === prospect.id)
                            .length) /
                        active.length
                      ).toFixed(1) + "%"}
              </b>
            </div>
            <div>
              Lost <b>{rows.filter((r) => r.lifecycle === "lost").length}</b>
            </div>
            <div>
              Converted{" "}
              <b>{rows.filter((r) => r.lifecycle === "converted").length}</b>
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chart}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#235c46" name="Active leads" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Stage / outcome</th>
                  <th>Age</th>
                  <th>PIC</th>
                  <th>Pending / overdue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <button
                        className="table-link"
                        onClick={() => navigate("/sales/" + r.id)}
                      >
                        {r.name}
                      </button>
                    </td>
                    <td>
                      {s.salesStages?.find((x) => x.id === r.stage)?.label ||
                        r.stage}{" "}
                      · {r.lifecycle}
                    </td>
                    <td>{r.age} hari</td>
                    <td>{s.people.find((x) => x.id === r.pic)?.name}</td>
                    <td>
                      {r.pending} / {r.overdue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
export function percentage(current: string, previous: string) {
  const p = minorUnits(previous);
  if (p <= 0n) return "N/A";
  const rounded = ((minorUnits(current) - p) * 10000n) / p;
  return `${rounded < 0n ? "−" : ""}${(rounded < 0n ? -rounded : rounded) / 100n}.${String((rounded < 0n ? -rounded : rounded) % 100n).padStart(2, "0")}%`;
}
export function Comparison({ s }: { s: Snapshot }) {
  const [period, setPeriod] = useState<"month" | "quarter">("month"),
    [anchor, setAnchor] = useState("");
  const state = useInsights("comparison", {
    period,
    anchor: anchor ? anchor + "-01" : undefined,
  });
  const d = state.data;
  const fields = [
    { key: "moneyIn", label: "Income / Receipts" },
    { key: "moneyOut", label: "Expense / Payments" },
    { key: "net", label: "Hasil kas" },
  ];
  return (
    <section className="p1-panel">
      <h2>Perbandingan kas</h2>
      <div className="filter-row">
        <select
          aria-label="Periode perbandingan"
          value={period}
          onChange={(e) => setPeriod(e.target.value as typeof period)}
        >
          <option value="month">Bulanan</option>
          <option value="quarter">Kuartalan</option>
        </select>
        <label>
          Periode terbaru{" "}
          <input
            type="month"
            max={s.today.slice(0, 7)}
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
          />
        </label>
        <Button variant="ghost" onClick={() => setAnchor("")}>
          Dua periode selesai
        </Button>
      </div>
      <Status state={state} />
      {d && (
        <>
          <p>
            {d.from}–{d.to}
            {d.partial && " · Partial period"} dibanding {d.previousFrom}–
            {d.previousTo}. Semua transaksi posted; General termasuk. Filter
            ledger tidak diterapkan di sini.
          </p>
          {(!d.currentCount || !d.previousCount) && (
            <p>Periode tanpa transaksi ditampilkan sebagai 0.</p>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ukuran</th>
                  <th>Sebelumnya</th>
                  <th>Terbaru</th>
                  <th>Delta</th>
                  <th>Perubahan</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.key}>
                    <td>{f.label}</td>
                    <td>{moneyLabel(d.previous[f.key])}</td>
                    <td>{moneyLabel(d.current[f.key])}</td>
                    <td>
                      {moneyLabel(
                        decimalString(
                          minorUnits(d.current[f.key]) -
                            minorUnits(d.previous[f.key]),
                        ),
                      )}
                    </td>
                    <td>
                      {f.key === "net"
                        ? "—"
                        : percentage(d.current[f.key], d.previous[f.key])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={fields.map((f) => ({
                  name: f.label,
                  previous: Number(d.previous[f.key]),
                  current: Number(d.current[f.key]),
                }))}
              >
                <XAxis dataKey="name" />
                <YAxis
                  tickFormatter={(v) =>
                    new Intl.NumberFormat("id-ID", {
                      notation: "compact",
                    }).format(v)
                  }
                />
                <Tooltip
                  formatter={(v) =>
                    new Intl.NumberFormat("id-ID").format(Number(v))
                  }
                />
                <Bar dataKey="previous" name="Sebelumnya" fill="#a8b7a6" />
                <Bar dataKey="current" name="Terbaru" fill="#235c46" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <small>
            Grafik dibulatkan untuk tampilan; tabel menggunakan nilai IDR tepat.
          </small>
        </>
      )}
    </section>
  );
}
export function AuditViewer({ s }: { s: Snapshot }) {
  return (
    <div className="table-wrap audit-history">
      <table>
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {s.audit?.map((a) => (
            <tr key={a.id}>
              <td>{localTimestamp(a.at)}</td>
              <td>
                {a.metadata.automatic
                  ? "System"
                  : s.people.find((p) => p.id === a.actor)?.name || a.actor}
              </td>
              <td>{a.action}</td>
              <td>{a.entity}</td>
              <td>
                <AuditDiff metadata={a.metadata} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!s.audit?.length && <p>Belum ada event pada pencarian ini.</p>}
    </div>
  );
}

export function Configuration({
  s,
  run,
  busy,
}: {
  s: Snapshot;
  run: (c: Command) => Promise<boolean>;
  busy: boolean;
}) {
  const [template, setTemplate] = useState<Template | null>(null),
    [kind, setKind] = useState<Template["kind"]>(
      can(s.user, "sales", true)
        ? "lead_note"
        : can(s.user, "trips", true)
          ? "trip_note"
          : "internal_doc",
    ),
    [content, setContent] = useState(""),
    [days, setDays] = useState<
      { title: string; items: { name: string; description: string }[] }[]
    >([{ title: "", items: [] }]);
  const [formError, setFormError] = useState("");
  const [section, setSection] = useState(
    can(s.user, "sales", true)
      ? "stages"
      : can(s.user, "trips", true)
        ? "trip-stages"
        : can(s.user, "finance", true)
          ? "categories"
          : "templates",
  );
  const stages = s.salesStages || [];
  const edit = (t: Template | null) => {
    setTemplate(t);
    setKind(
      t?.kind ||
        (can(s.user, "sales", true)
          ? "lead_note"
          : can(s.user, "trips", true)
            ? "trip_note"
            : "internal_doc"),
    );
    setContent(typeof t?.content === "string" ? t.content : "");
    setDays(
      Array.isArray(t?.content)
        ? structuredClone(t.content)
        : [{ title: "", items: [] }],
    );
    setFormError("");
  };
  return (
    <section className="p1-panel">
      <div className="configuration-tabs" aria-label="Bagian konfigurasi">
        {[
          ["stages", "Sales stages"],
          ["trip-stages", "Pipeline Trips"],
          ["categories", "Kategori Finance"],
          ["templates", "Templates"],
        ]
          .filter(([id]) =>
            id === "stages"
              ? can(s.user, "sales", true)
              : id === "trip-stages"
                ? can(s.user, "trips", true)
                : id === "categories"
                  ? can(s.user, "finance", true)
                  : ["sales", "trips", "docs"].some((m) =>
                      can(s.user, m as "sales" | "trips" | "docs", true),
                    ),
          )
          .map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={section === id}
              onClick={() => {
                setSection(id);
                setFormError("");
              }}
            >
              {label}
            </button>
          ))}
      </div>
      {formError && <p role="alert">{formError}</p>}
      <section className="configuration-list" hidden={section !== "stages"}>
        <h2>Sales stages</h2>
        <p>
          Pergantian nama tetap mempertahankan lead terkait. Retire memindahkan
          semua lead aktif ke tahapan pengganti sebelum menonaktifkan tahapan
          lama.
        </p>
        {stages.map((st) => (
          <form
            className="configuration-row"
            key={st.id + st.version}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run({
                action: "save_stage",
                version: st.version,
                data: {
                  id: st.id,
                  label: f.get("label"),
                  position: Number(f.get("position")),
                  is_default: f.get("default") === "on",
                },
              });
            }}
          >
            <input
              aria-label={"Label " + st.label}
              name="label"
              required
              maxLength={80}
              defaultValue={st.label}
            />
            <input
              aria-label={"Urutan " + st.label}
              name="position"
              type="number"
              required
              defaultValue={st.position}
            />
            <label>
              <input
                name="default"
                type="checkbox"
                defaultChecked={st.is_default}
                disabled={!st.active}
              />
              Default
            </label>
            <span>{st.active ? "Active" : "Retired"}</span>
            <Button disabled={busy} size="sm">
              Simpan
            </Button>
            {st.active && (
              <>
                <select
                  aria-label={"Replacement " + st.label}
                  name="replacement"
                >
                  <option value="">Replacement…</option>
                  {stages
                    .filter((x) => x.active && x.id !== st.id)
                    .map((x) => (
                      <option value={x.id} key={x.id}>
                        {x.label}
                      </option>
                    ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={(e) => {
                    const f = new FormData(e.currentTarget.form!);
                    const replacement = f.get("replacement");
                    if (!replacement) {
                      setFormError("Pilih replacement aktif.");
                      return;
                    }
                    if (
                      confirm(
                        "Retire stage dan pindahkan active leads ke replacement?",
                      )
                    )
                      void run({
                        action: "retire_stage",
                        version: st.version,
                        data: { id: st.id, replacement },
                      });
                  }}
                >
                  Retire
                </Button>
              </>
            )}
          </form>
        ))}
        <form
          className="configuration-row"
          onSubmit={async (e) => {
            e.preventDefault();
            const el = e.currentTarget,
              f = new FormData(el);
            if (
              await run({
                action: "save_stage",
                data: { label: f.get("label"), position: stages.length },
              })
            )
              el.reset();
          }}
        >
          <input
            aria-label="Stage baru"
            name="label"
            required
            maxLength={80}
            placeholder="Stage baru"
          />
          <Button disabled={busy}>Tambah stage</Button>
        </form>
      </section>
      <section hidden={section !== "trip-stages"}>
        <TripPipeline s={s} run={run} busy={busy} />
      </section>
      <section className="configuration-list" hidden={section !== "categories"}>
        <h2>Kategori Finance</h2>
        <p>
          Direction tetap. Deactivate mencegah entry baru; histori tetap
          tersedia.
        </p>
        {s.categories.map((cat) => (
          <form
            className="configuration-row"
            key={cat.id + String(cat.version)}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run({
                action: "save_category",
                version: cat.version,
                data: {
                  id: cat.id,
                  name: f.get("name"),
                  direction: cat.direction,
                  active: f.get("active") === "on",
                },
              });
            }}
          >
            <input
              aria-label={"Kategori " + cat.name}
              name="name"
              required
              maxLength={100}
              defaultValue={cat.name}
            />
            <span>{cat.direction}</span>
            <label>
              <input
                type="checkbox"
                name="active"
                defaultChecked={cat.active !== false}
              />
              Active
            </label>
            <Button size="sm" disabled={busy}>
              Simpan
            </Button>
          </form>
        ))}
        <form
          className="configuration-row"
          onSubmit={async (e) => {
            e.preventDefault();
            const el = e.currentTarget,
              f = new FormData(el);
            if (
              await run({
                action: "save_category",
                data: { name: f.get("name"), direction: f.get("direction") },
              })
            )
              el.reset();
          }}
        >
          <input
            aria-label="Kategori baru"
            name="name"
            required
            maxLength={100}
            placeholder="Kategori baru"
          />
          <select name="direction" aria-label="Arah kategori">
            <option value="in">Income / Receipts</option>
            <option value="out">Expense / Payments</option>
          </select>
          <Button disabled={busy}>Tambah kategori</Button>
        </form>
      </section>
      <section hidden={section !== "templates"}>
        <h2>Templates</h2>
        <p>
          Template disalin saat diterapkan. Perubahan di sini tidak mengubah
          existing records.
        </p>
        <div className="configuration-row">
          <select
            aria-label="Pilih template"
            value={template?.id || ""}
            onChange={(e) =>
              edit(s.templates?.find((t) => t.id === e.target.value) || null)
            }
          >
            <option value="">Template baru</option>
            {s.templates
              ?.filter((t) =>
                can(
                  s.user,
                  t.kind === "lead_note"
                    ? "sales"
                    : t.kind === "internal_doc"
                      ? "docs"
                      : "trips",
                  true,
                ),
              )
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {!t.active ? " (inactive)" : ""}
                </option>
              ))}
          </select>
          <Button variant="outline" onClick={() => edit(null)}>
            Baru
          </Button>
        </div>
        <form
          key={template?.id || "new"}
          className="template-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (
              await run({
                action: "save_template",
                id: template?.id,
                version: template?.version,
                data: {
                  name: f.get("name"),
                  kind,
                  content: kind === "itinerary" ? days : content,
                  active: f.get("active") === "on",
                },
              })
            )
              edit(null);
          }}
        >
          <label>
            Nama
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={template?.name || ""}
            />
          </label>
          <label>
            Jenis
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              {can(s.user, "sales", true) && (
                <option value="lead_note">Lead note</option>
              )}
              {can(s.user, "trips", true) && (
                <>
                  <option value="trip_note">Trip note</option>
                  <option value="itinerary">Itinerary</option>
                </>
              )}
              {can(s.user, "docs", true) && (
                <option value="internal_doc">Internal document</option>
              )}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              name="active"
              defaultChecked={template?.active !== false}
            />
            Active
          </label>
          {kind !== "itinerary" ? (
            <>
              <RichEditor
                label="Markdown template"
                disabled={busy}
                value={content}
                onChange={setContent}
              />
            </>
          ) : (
            <>
              {days.map((day, i) => (
                <div className="template-day" key={i}>
                  <label>
                    Day {i + 1}
                    <input
                      aria-label={"Judul Day " + (i + 1)}
                      value={day.title}
                      onChange={(e) =>
                        setDays(
                          days.map((x, n) =>
                            n === i ? { ...x, title: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  {day.items.map((item, k) => (
                    <div className="configuration-row" key={k}>
                      <input
                        aria-label="Nama aktivitas"
                        required
                        value={item.name}
                        onChange={(e) =>
                          setDays(
                            days.map((x, n) =>
                              n === i
                                ? {
                                    ...x,
                                    items: x.items.map((y, o) =>
                                      o === k
                                        ? { ...y, name: e.target.value }
                                        : y,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      <RichEditor
                        label="Deskripsi aktivitas"
                        value={item.description}
                        onChange={(description) =>
                          setDays(
                            days.map((x, n) =>
                              n === i
                                ? {
                                    ...x,
                                    items: x.items.map((y, o) =>
                                      o === k ? { ...y, description } : y,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setDays(
                            days.map((x, n) =>
                              n === i
                                ? {
                                    ...x,
                                    items: x.items.filter((_, o) => o !== k),
                                  }
                                : x,
                            ),
                          )
                        }
                      >
                        Hapus item
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setDays(
                        days.map((x, n) =>
                          n === i
                            ? {
                                ...x,
                                items: [
                                  ...x.items,
                                  { name: "", description: "" },
                                ],
                              }
                            : x,
                        ),
                      )
                    }
                  >
                    Tambah item
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={days.length === 1}
                    onClick={() => setDays(days.filter((_, n) => n !== i))}
                  >
                    Hapus day
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={days.length >= 90}
                onClick={() => setDays([...days, { title: "", items: [] }])}
              >
                Tambah day
              </Button>
            </>
          )}
          <Button disabled={busy}>Simpan template</Button>
        </form>
      </section>
    </section>
  );
}
export function ApplyTemplate({
  s,
  j,
  run,
  busy,
  area,
}: {
  s: Snapshot;
  j: Journey;
  run: (c: Command) => Promise<boolean>;
  busy: boolean;
  area: "notes" | "itinerary";
}) {
  return (
    <details className="template-picker">
      <summary>
        {area === "notes" ? "Note template" : "Itinerary template"}
      </summary>
      <form
        className="template-controls"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (
            confirm(
              "Terapkan template? Replace mengganti seluruh notes atau itinerary; Append menambah salinan baru.",
            )
          )
            void run({
              action: "apply_template",
              id: j.id,
              version: j.version,
              data: { template: f.get("template"), mode: f.get("mode") },
            });
        }}
      >
        <select name="template" aria-label="Template" required disabled={busy}>
          <option value="">Pilih template…</option>
          {s.templates
            ?.filter(
              (t) =>
                t.active &&
                t.kind ===
                  (area === "itinerary"
                    ? "itinerary"
                    : j.kind === "lead"
                      ? "lead_note"
                      : "trip_note"),
            )
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
        <select name="mode" aria-label="Mode penerapan" disabled={busy}>
          <option value="append">Append</option>
          <option value="replace">Replace</option>
        </select>
        <Button disabled={busy} variant="outline" size="sm">
          Terapkan template
        </Button>
      </form>
    </details>
  );
}
