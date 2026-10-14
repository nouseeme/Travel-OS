"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Handshake,
  Map,
  Wallet,
  Users,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowUpLeft,
  Search,
  Menu,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Clock3,
  CalendarDays,
  FolderArchive,
  ArrowLeft,
  ShieldCheck,
  Compass,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronRight as Right,
} from "lucide-react";
import type {
  Snapshot,
  Command,
  Filters,
  Module,
  Journey,
  Transaction,
} from "@/lib/model";
import { stages, tripStages, taskStages } from "@/lib/model";
import {
  can,
  moneyLabel,
  shortDate,
  initials,
  deadline,
  periodLabel,
} from "@/lib/format";
import { Button } from "./ui/button";
import { Auth } from "./auth";
import { Board } from "./board";
import { Forms, type Editor } from "./forms";
import { Detail } from "./detail";
import { ProductBrand, CompanyIdentity } from "./brand";
import { localTimezone, dateInZone } from "@/lib/time";
import {
  Calendar,
  SalesAnalytics,
  Comparison,
  Configuration,
  AuditViewer,
} from "./p1";
export function Dashboard() {
  const path = usePathname(),
    router = useRouter();
  const parts = path.split("/").filter(Boolean);
  const view =
    parts[0] === "settings"
      ? ["configuration", "audit"].includes(parts[1])
        ? parts[1]
        : "people"
      : ["sales", "trips", "finance"].includes(parts[0])
        ? parts[0]
        : "home";
  const recordId =
    parts[1] && parts[1] !== "archive" && ["sales", "trips"].includes(parts[0])
      ? parts[1]
      : undefined;
  const archive = path === "/sales/archive";
  const auth = path === "/login" || path === "/create-password";
  const initialDate = dateInZone();
  const [s, setS] = useState<Snapshot | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [activationUrl, setActivationUrl] = useState(""),
    [editor, setEditor] = useState<Editor | null>(null),
    [busy, setBusy] = useState(false),
    [sidebar, setSidebar] = useState(false),
    [filters, setFilters] = useState<Filters>(() =>
      view === "finance"
        ? {
            from: initialDate.slice(0, 7) + "-01",
            to: initialDate,
            status: "posted",
          }
        : {},
    ),
    [financeTab, setFinanceTab] = useState("transactions"),
    [journeyTab, setJourneyTab] = useState("board"),
    [appliedFilters, setAppliedFilters] = useState<Filters>({}),
    [dirty, setDirty] = useState(false);
  const requestSequence = useRef(0),
    sending = useRef(false);
  const effective = {
    ...filters,
    ...(archive ? { lifecycle: "archive" } : {}),
  };
  const fetchState = useCallback(async () => {
    if (auth) return;
    const seq = ++requestSequence.current;
    setLoading(true);
    try {
      const q = new URLSearchParams({
        view,
        timezone: localTimezone(),
        ...(recordId ? { id: recordId } : {}),
        ...Object.fromEntries(
          Object.entries({
            ...filters,
            ...(archive ? { lifecycle: "archive" } : {}),
          }).filter(([, v]) => v !== undefined && v !== ""),
        ),
      });
      const r = await fetch("/api/workspace?" + q, { cache: "no-store" });
      const d = await r.json();
      if (seq !== requestSequence.current) return;
      if (!r.ok) {
        if (r.status === 401) {
          router.replace("/login");
          return;
        }
        throw Error(d.error);
      }
      setS({ ...d, today: dateInZone(), timezone: localTimezone() });
      if (view === "trips") setJourneyTab(d.tripView || "board");
      setAppliedFilters(filters);
      setError("");
    } catch (e) {
      if (seq === requestSequence.current) {
        setS(null);
        setError((e as Error).message);
      }
    } finally {
      if (seq === requestSequence.current) setLoading(false);
    }
  }, [view, recordId, JSON.stringify(filters), archive, auth, router]);
  useEffect(() => {
    void fetchState();
    return () => {
      requestSequence.current++;
    };
  }, [fetchState]);
  useEffect(() => {
    const refreshLocalDay = () => {
      if (s && (s.today !== dateInZone() || s.timezone !== localTimezone())) void fetchState();
    };
    const timer = window.setInterval(refreshLocalDay, 60000);
    window.addEventListener("focus", refreshLocalDay);
    return () => {window.clearInterval(timer);window.removeEventListener("focus",refreshLocalDay);};
  }, [s?.today, s?.timezone, fetchState]);
  useEffect(() => {
    if (!dirty) return;
    const fn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  function navigate(url: string) {
    if (dirty && !confirm("Ada perubahan belum disimpan. Tinggalkan halaman?"))
      return;
    setDirty(false);
    setSidebar(false);
    router.push(url);
  }
  async function run(c: Command) {
    if (sending.current) return false;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...c, timezone: localTimezone() }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) {
          setS(null);
          setEditor(null);
          setDirty(false);
        }
        throw Error(d.error);
      }
      setNotice(d.message || "Perubahan tersimpan.");
      if (d.activation_url) setActivationUrl(d.activation_url);
      setEditor(null);
      if (c.action === "convert") {
        setDirty(false);
        navigate("/trips/" + d.id);
      } else await fetchState();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function logout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.replace("/login");
  }
  function open(e: Editor) {
    if (
      dirty &&
      ["journey", "convert", "archive"].includes(e.kind) &&
      !confirm(
        "Detail akan disimpan ulang. Buang perubahan notes/itinerary/contacts yang belum disimpan?",
      )
    )
      return;
    setError("");
    setEditor(e);
  }
  async function exportCsv() {
    setBusy(true);
    try {
      const r = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...effective, timezone: localTimezone() }),
      });
      if (!r.ok) throw Error((await r.json()).error);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `Travel-OS-IDR-${s!.today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice("CSV matching filter diexport.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const filter = (key: keyof Filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value, page: "0" }));
  if (auth) return <Auth passwordMode={path === "/create-password"} />;
  if (
    !["home", "sales", "trips", "finance", "settings"].includes(
      parts[0] || "home",
    ) ||
    (parts[0] === "settings" &&
      (!["people", "configuration", "audit"].includes(parts[1]) ||
        parts.length !== 2)) ||
    (["home", "finance"].includes(parts[0]) && parts.length > 1) ||
    (["sales", "trips"].includes(parts[0]) && parts.length > 2)
  )
    return (
      <div className="auth-page">
        <h1>Halaman tidak ditemukan.</h1>
        <Button onClick={() => navigate("/home")}>Ke Home</Button>
      </div>
    );
  const title = {
    home: "Home",
    sales: "Sales CRM",
    trips: "Trips",
    finance: "Finance",
    people: "People",
    configuration: "Configuration",
    audit: "Audit history",
  }[view];
  const j = s?.journeys.find((j) => j.id === recordId);
  return (
    <div className="app-shell">
      <aside
        id="workspace-sidebar"
        aria-label="Navigasi workspace"
        className={"sidebar " + (sidebar ? "mobile-open" : "")}
        onKeyDown={(e) => {
          if (e.key === "Escape") setSidebar(false);
        }}
      >
        <button
          className="brand"
          aria-label="travelOS — Home"
          onClick={() => navigate("/home")}
        >
          <ProductBrand />
        </button>
        <div className="workspace-picker">
          <CompanyIdentity />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {[
            { id: "home", label: "Home", icon: LayoutGrid },
            { id: "sales", label: "Sales CRM", icon: Handshake },
            { id: "trips", label: "Trips", icon: Map },
            { id: "finance", label: "Finance", icon: Wallet },
          ]
            .filter(
              (n) => n.id === "home" || (s && can(s.user, n.id as Module)),
            )
            .map((n) => (
              <button
                key={n.id}
                className={view === n.id ? "active" : ""}
                aria-current={view === n.id ? "page" : undefined}
                onClick={() => navigate("/" + n.id)}
              >
                <n.icon size={18} />
                {n.label}
                {n.id === "home" && (
                  <span className="nav-count">
                    {s?.tasks.filter((t) => t.status !== "Done").length || 0}
                  </span>
                )}
              </button>
            ))}
        </nav>
        {s?.user.role === "admin" && (
          <>
            <span className="nav-label">TEAM & SETTINGS</span>
            <nav>
              <button
                className={view === "people" ? "active" : ""}
                onClick={() => navigate("/settings/people")}
              >
                <Users size={18} />
                People
              </button>
              <button
                className={view === "configuration" ? "active" : ""}
                onClick={() => navigate("/settings/configuration")}
              >
                <Settings size={18} />
                Configuration
              </button>
              <button
                className={view === "audit" ? "active" : ""}
                onClick={() => navigate("/settings/audit")}
              >
                <ShieldCheck size={18} />
                Audit history
              </button>
            </nav>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <span className="status-dot tone-1" /> Egimu Travel · Internal
          </div>
          <div className="sidebar-user">
            <span className="avatar">
              {initials(s?.user.name || "Travel OS")}
            </span>
            <div>
              <b>{s?.user.name || "Workspace"}</b>
              <small>{s?.user.role || "Invite only"}</small>
            </div>
            <button aria-label="Logout" onClick={logout}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      {sidebar && (
        <button
          aria-label="Tutup menu"
          className="mobile-shade"
          onClick={() => setSidebar(false)}
        />
      )}
      <div className="app-main">
        <header className="topbar">
          <div>
            <button
              className="mobile-toggle"
              onClick={() => setSidebar(!sidebar)}
              aria-label="Buka menu"
              aria-expanded={sidebar}
              aria-controls="workspace-sidebar"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <Right size={13} />
            <b>{title}</b>
            {j && (
              <>
                <Right size={13} />
                <span>{j.name || j.client}</span>
              </>
            )}
          </div>
          <div>
            <span className="top-date">
              <CalendarDays size={14} />
              {s ? shortDate(s.today) : "Local time"}
            </span>
            <button
              className="round-button"
              aria-label="Reload"
              onClick={() => {
                if (
                  !dirty ||
                  confirm("Reload akan mengganti perubahan lokal. Lanjutkan?")
                ) {
                  setDirty(false);
                  fetchState();
                }
              }}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>
        <main className="workspace-content">
          {loading && s && (
            <div className="notice" role="status">
              Memuat hasil terbaru. Data sebelumnya tetap ditampilkan sampai
              request berhasil.
            </div>
          )}
          {notice && (
            <div className="success-toast" role="status">
              <CheckCircle2 size={16} />
              {notice}
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}
          {error && !editor && (
            <div className="error-box" role="alert">
              {error}
              <Button size="sm" variant="outline" onClick={fetchState}>
                Coba lagi
              </Button>
              {!s && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/login")}
                >
                  Login / setup
                </Button>
              )}
            </div>
          )}
          {loading && !s ? (
            <div className="loading-state">
              <RefreshCw size={22} className="spin" />
              <p>Menyiapkan ruang kerja…</p>
            </div>
          ) : (
            s && (
              <>
                {recordId && j ? (
                  <Detail
                    key={j.id}
                    journey={j}
                    snapshot={s}
                    busy={busy}
                    error={error}
                    onCommand={run}
                    onEdit={open}
                    onNavigate={navigate}
                    onDirty={setDirty}
                  />
                ) : (
                  <>
                    <section className="page-heading">
                      <div>
                        <div className="eyebrow">
                          {view === "home"
                            ? "YOUR DAILY COMPASS"
                            : view === "sales"
                              ? "FROM CONVERSATION TO OPPORTUNITY"
                              : view === "trips"
                                ? "GOOD JOURNEYS, WELL PLANNED"
                                : view === "finance"
                                  ? "EVERY RUPIAH, ACCOUNTED FOR"
                                  : "A SMALL TEAM, SHARED DIRECTION"}
                        </div>
                        <h1>
                          {view === "home"
                            ? `Selamat ${Number(new Intl.DateTimeFormat("en", { timeZone: s.timezone, hour: "numeric", hour12: false }).format(new Date())) < 12 ? "pagi" : "datang"}, ${s.user.name.split(" ")[0]}.`
                            : archive
                              ? "Lead archive"
                              : view === "sales"
                                ? "Percakapan jadi perjalanan."
                                : view === "trips"
                                  ? "Rencanakan setiap perjalanan."
                                  : view === "finance"
                                    ? "Pencatatan kas, jelas."
                                    : view === "configuration"
                                      ? "Atur ruang kerja Anda."
                                      : view === "audit"
                                        ? "Jejak perubahan tim."
                                        : "Tim Anda, terhubung."}
                        </h1>
                        <p>
                          {view === "home"
                            ? "Apa yang ingin kita selesaikan hari ini? Semua pekerjaan Anda ada di sini."
                            : archive
                              ? "Riwayat opportunity tetap tersimpan dan dapat ditelusuri."
                              : view === "sales"
                                ? "Kelola opportunity, follow-up, dan langkah berikutnya dalam satu alur."
                                : view === "trips"
                                  ? "Dari itinerary pertama sampai tamu kembali pulang."
                                  : view === "finance"
                                    ? "Catat Money In dan Money Out. Satu ledger, dalam IDR."
                                    : view === "configuration"
                                      ? "Sesuaikan tahapan Sales, kategori kas, dan template perjalanan."
                                      : view === "audit"
                                        ? "Telusuri tindakan penting dan koreksi tanpa mengubah riwayat."
                                        : "Kelola invitation dan akses setiap anggota workspace."}
                        </p>
                      </div>
                      <div className="heading-actions">
                        {view === "home" && (
                          <Button
                            onClick={() =>
                              open({ kind: "task", context: "internal" })
                            }
                          >
                            <Plus size={16} />
                            Internal task
                          </Button>
                        )}
                        {view === "sales" && (
                          <>
                            <Button
                              variant="outline"
                              onClick={() =>
                                navigate(archive ? "/sales" : "/sales/archive")
                              }
                            >
                              <FolderArchive size={16} />
                              {archive ? "Active board" : "Archive"}
                            </Button>
                            {!archive && can(s.user, "sales", true) && (
                              <Button
                                onClick={() =>
                                  open({ kind: "journey", context: "lead" })
                                }
                              >
                                <Plus size={16} />
                                Lead baru
                              </Button>
                            )}
                          </>
                        )}
                        {view === "trips" && can(s.user, "trips", true) && (
                          <Button
                            onClick={() =>
                              open({ kind: "journey", context: "trip" })
                            }
                          >
                            <Plus size={16} />
                            Trip baru
                          </Button>
                        )}
                        {view === "finance" && can(s.user, "finance", true) && (
                          <>
                            <Button
                              variant="outline"
                              onClick={() =>
                                open({ kind: "transaction", direction: "out" })
                              }
                            >
                              <ArrowUpRight size={16} />
                              Money Out
                            </Button>
                            <Button
                              onClick={() =>
                                open({ kind: "transaction", direction: "in" })
                              }
                            >
                              <Plus size={16} />
                              Money In
                            </Button>
                          </>
                        )}
                        {view === "people" && (
                          <Button onClick={() => open({ kind: "invite" })}>
                            <Plus size={16} />
                            Undang member
                          </Button>
                        )}
                      </div>
                    </section>
                    {view === "home" && (
                      <>
                        <div className="summary-grid">
                          <Stat
                            label="Perlu dikerjakan"
                            value={String(s.taskCounts.Assigned || 0)}
                            icon={LayoutGrid}
                            text="Assigned tasks"
                          />
                          <Stat
                            label="Sedang berjalan"
                            value={String(s.taskCounts.Doing || 0)}
                            icon={Clock3}
                            text="Satu langkah lebih dekat"
                          />
                          <Stat
                            label="Selesai"
                            value={String(s.taskCounts.Done || 0)}
                            icon={CheckCircle2}
                            text="Pekerjaan yang dituntaskan"
                          />
                          <Stat
                            label="Perlu perhatian"
                            value={String(
                              s.tasks.filter(
                                (t) => deadline(t, s.today) === "Overdue",
                              ).length,
                            )}
                            icon={CalendarDays}
                            text="Deadline sudah terlewat"
                            warn
                          />
                        </div>
                        <div className="section-toolbar">
                          <div>
                            <h2>
                              My Tasks{" "}
                              <span className="subtle-count">
                                {s.tasks.length}
                              </span>
                            </h2>
                            <p>Pekerjaan dari Internal, Sales, dan Trips.</p>
                          </div>
                          {s.user.role === "admin" && (
                            <label className="inline-label">
                              Assignee
                              <select
                                value={filters.assignee || s.user.id}
                                onChange={(e) =>
                                  filter("assignee", e.target.value)
                                }
                              >
                                <option value="all">Semua anggota</option>
                                {s.people
                                  .filter((p) => p.status === "active")
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          )}
                        </div>
                        <div className="filter-row">
                          <label>
                            Dari due date{" "}
                            <input
                              aria-label="Home due dari"
                              type="date"
                              value={filters.from || ""}
                              onChange={(e) => filter("from", e.target.value)}
                            />
                          </label>
                          <label>
                            Sampai{" "}
                            <input
                              aria-label="Home due sampai"
                              type="date"
                              value={filters.to || ""}
                              onChange={(e) => filter("to", e.target.value)}
                            />
                          </label>
                          <select
                            aria-label="Task context"
                            value={filters.context || ""}
                            onChange={(e) => filter("context", e.target.value)}
                          >
                            <option value="">Semua context</option>
                            <option value="internal">Internal</option>
                            <option value="lead">Sales</option>
                            <option value="trip">Trips</option>
                          </select>
                        </div>
                        <Board
                          columns={taskStages}
                          s={s}
                          mode="tasks"
                          onCommand={run}
                          onEdit={(t) =>
                            open({ kind: "task", task: t, context: t.context })
                          }
                          onNavigate={navigate}
                          onAdd={() =>
                            open({ kind: "task", context: "internal" })
                          }
                        />
                        {Object.entries(s.taskCounts).some(
                          ([status, count]) =>
                            count >
                            s.tasks.filter((t) => t.status === status).length,
                        ) && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              setFilters((f) => ({
                                ...f,
                                page: String(Number(f.page || 0) + 1),
                              }))
                            }
                          >
                            Load more tasks
                          </Button>
                        )}
                        <div className="home-foot">
                          <span className="status-dot tone-1" /> Semua task
                          menggunakan sumber data yang sama. Perubahan langsung
                          tersedia di parent.
                        </div>
                      </>
                    )}
                    {(view === "sales" || view === "trips") && (
                      <>
                        <div className="section-toolbar board-toolbar">
                          <div className="view-tabs">
                            <button
                              className={
                                journeyTab === "board" ? "selected" : ""
                              }
                              onClick={() =>
                                view === "trips"
                                  ? run({
                                      action: "trip_view",
                                      data: { view: "board" },
                                    })
                                  : setJourneyTab("board")
                              }
                            >
                              <LayoutGrid size={15} />
                              {archive ? "Archive" : "Board"}
                            </button>
                            {!archive && view === "trips" && (
                              <button
                                className={
                                  journeyTab === "calendar" ? "selected" : ""
                                }
                                onClick={() =>
                                  run({
                                    action: "trip_view",
                                    data: { view: "calendar" },
                                  })
                                }
                              >
                                <CalendarDays size={15} />
                                Calendar
                              </button>
                            )}
                            {!archive && view === "sales" && (
                              <button
                                className={
                                  journeyTab === "analytics" ? "selected" : ""
                                }
                                onClick={() => setJourneyTab("analytics")}
                              >
                                Analytics
                              </button>
                            )}
                          </div>
                          <div className="filter-row">
                            <label className="search-box">
                              <Search size={16} />
                              <input
                                aria-label="Cari lead atau trip"
                                placeholder="Cari klien atau perjalanan…"
                                value={filters.search || ""}
                                onChange={(e) =>
                                  filter("search", e.target.value)
                                }
                              />
                            </label>
                            <select
                              aria-label="Filter PIC"
                              value={filters.pic || ""}
                              onChange={(e) => filter("pic", e.target.value)}
                            >
                              <option value="">Semua PIC</option>
                              {s.people.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        {archive ? (
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Opportunity</th>
                                  <th>Outcome</th>
                                  <th>Archived</th>
                                  <th>Reason</th>
                                  <th />
                                </tr>
                              </thead>
                              <tbody>
                                {s.journeys.map((j) => (
                                  <tr key={j.id}>
                                    <td>
                                      <button
                                        className="table-link"
                                        onClick={() =>
                                          navigate("/sales/" + j.id)
                                        }
                                      >
                                        {j.name || j.client}
                                      </button>
                                      <small>{j.client}</small>
                                    </td>
                                    <td>
                                      <span className="tag">{j.lifecycle}</span>
                                    </td>
                                    <td>{shortDate(j.archived_at || "")}</td>
                                    <td>{j.lost_reason || "—"}</td>
                                    <td>
                                      {j.lifecycle !== "converted" &&
                                        can(s.user, "sales", true) && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              open({
                                                kind: "restore",
                                                journey: j,
                                                context: "lead",
                                              })
                                            }
                                          >
                                            Restore
                                          </Button>
                                        )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {!s.journeys.length && (
                              <Empty text="Belum ada lead di archive." />
                            )}
                          </div>
                        ) : journeyTab === "calendar" && view === "trips" ? (
                          <Calendar
                            s={s}
                            filters={filters}
                            navigate={navigate}
                          />
                        ) : journeyTab === "analytics" && view === "sales" ? (
                          <>
                            <div className="filter-row">
                              <label>
                                Dibuat dari{" "}
                                <input
                                  type="date"
                                  value={filters.from || ""}
                                  onChange={(e) =>
                                    filter("from", e.target.value)
                                  }
                                />
                              </label>
                              <label>
                                Sampai{" "}
                                <input
                                  type="date"
                                  value={filters.to || ""}
                                  onChange={(e) => filter("to", e.target.value)}
                                />
                              </label>
                            </div>
                            <SalesAnalytics
                              s={s}
                              filters={filters}
                              navigate={navigate}
                            />
                          </>
                        ) : (
                          <Board
                            columns={
                              view === "sales"
                                ? s.salesStages
                                    ?.filter((x) => x.active)
                                    .map((x) => x.id) || stages
                                : tripStages
                            }
                            labels={Object.fromEntries(
                              (s.salesStages || []).map((x) => [x.id, x.label]),
                            )}
                            mode="journeys"
                            s={s}
                            onCommand={run}
                            onEdit={() => {}}
                            onNavigate={navigate}
                            onAdd={() =>
                              open({
                                kind: "journey",
                                context: view === "sales" ? "lead" : "trip",
                              })
                            }
                          />
                        )}
                        <Pagination
                          count={s.count}
                          page={Number(filters.page || 0)}
                          onPage={(p) => filter("page", String(p))}
                        />
                      </>
                    )}
                    {view === "finance" && (
                      <>
                        <div className="section-toolbar">
                          <div className="view-tabs">
                            <button
                              className={
                                financeTab === "transactions" ? "selected" : ""
                              }
                              onClick={() => setFinanceTab("transactions")}
                            >
                              Transactions
                            </button>
                            <button
                              className={
                                financeTab === "overview" ? "selected" : ""
                              }
                              onClick={() => setFinanceTab("overview")}
                            >
                              Overview
                            </button>
                            <button
                              className={
                                financeTab === "comparison" ? "selected" : ""
                              }
                              onClick={() => setFinanceTab("comparison")}
                            >
                              Comparison
                            </button>
                          </div>
                          {s.user.role === "admin" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy || loading}
                              onClick={exportCsv}
                            >
                              <Download size={15} />
                              Export CSV
                            </Button>
                          )}
                        </div>
                        {financeTab !== "comparison" && (
                          <FinanceFilters
                            s={s}
                            filters={filters}
                            onFilter={filter}
                            onAllTime={() => setFilters({ status: "posted" })}
                          />
                        )}
                        {financeTab !== "comparison" && (
                          <CashStats
                            s={s}
                            period={periodLabel(appliedFilters)}
                          />
                        )}
                        {financeTab === "comparison" ? (
                          <Comparison s={s} />
                        ) : financeTab === "transactions" ? (
                          <>
                            <Ledger
                              s={s}
                              canEdit={can(s.user, "finance", true)}
                              onEdit={open}
                            />
                            <Pagination
                              count={s.count}
                              page={Number(filters.page || 0)}
                              onPage={(p) => filter("page", String(p))}
                            />
                          </>
                        ) : (
                          <>
                            <div className="section-toolbar">
                              <h2>Hasil kas per Trip</h2>
                              <span className="pill">
                                Filter periode yang sama
                              </span>
                            </div>
                            <div className="table-wrap">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Trip / Context</th>
                                    <th>Money In</th>
                                    <th>Money Out</th>
                                    <th>Hasil kas</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {s.cashRows.map((r) => (
                                    <tr key={r.id}>
                                      <td>{r.name}</td>
                                      <td>{moneyLabel(r.moneyIn)}</td>
                                      <td>{moneyLabel(r.moneyOut)}</td>
                                      <td
                                        className={
                                          BigInt(r.net) < 0
                                            ? "negative"
                                            : "positive"
                                        }
                                      >
                                        {moneyLabel(r.net)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {!s.cashRows.length && (
                                <Empty text="Belum ada transaksi pada periode ini." />
                              )}
                            </div>
                            <div className="notice">
                              Hasil kas adalah Money In − Money Out. Quoted
                              price tidak dihitung; modal dan pinjaman termasuk
                              kas. Angka ini bukan bank balance atau accrual
                              profit.
                            </div>
                          </>
                        )}
                      </>
                    )}
                    {view === "configuration" && (
                      <Configuration s={s} run={run} busy={busy} />
                    )}
                    {view === "audit" && (
                      <>
                        <input
                          aria-label="Cari audit"
                          placeholder="Cari action / entity"
                          value={filters.search || ""}
                          onChange={(e) => filter("search", e.target.value)}
                        />
                        <AuditViewer s={s} />
                        <Pagination
                          count={s.count}
                          page={Number(filters.page || 0)}
                          onPage={(p) => filter("page", String(p))}
                        />
                      </>
                    )}
                    {view === "people" && (
                      <>
                        {activationUrl && (
                          <div className="notice">
                            <label>
                              Link aktivasi — salin lalu kirim sendiri
                              <input
                                aria-label="Link aktivasi"
                                readOnly
                                value={activationUrl}
                                onFocus={(e) => e.target.select()}
                              />
                            </label>
                            <p>
                              Link hanya ditampilkan sekali dan mengikuti expiry
                              provider. Generate ulang membatalkan generation
                              sebelumnya.
                            </p>
                            <Button
                              variant="ghost"
                              onClick={() => setActivationUrl("")}
                            >
                              Tutup link
                            </Button>
                          </div>
                        )}
                        <div className="people-summary">
                          <ShieldCheck size={20} />
                          <div>
                            <b>
                              {s.people.filter((p) => p.status === "active")
                                .length +
                                s.invitations.filter(
                                  (i) =>
                                    !["accepted", "revoked"].includes(i.status),
                                ).length}{" "}
                              member aktif + invitation pending
                            </b>
                            <p>
                              Tidak ada batas jumlah member di aplikasi.
                              Privilege mengikuti modul, bukan PIC.
                            </p>
                          </div>
                        </div>
                        <div className="people-grid">
                          {s.people.map((p) => (
                            <article className="person-card" key={p.id}>
                              <div className="person-card-head">
                                <span className="avatar large">
                                  {initials(p.name)}
                                </span>
                                <span
                                  className={
                                    "tag " +
                                    (p.status === "active" ? "trip" : "neutral")
                                  }
                                >
                                  {p.status}
                                </span>
                              </div>
                              <h3>{p.name}</h3>
                              <p>{p.email}</p>
                              <span className="role-label">{p.role}</span>
                              <div className="access-list">
                                {(
                                  ["sales", "trips", "finance"] as Module[]
                                ).map((m) => (
                                  <div key={m}>
                                    <span>{m}</span>
                                    <b>
                                      {p.role === "admin"
                                        ? "Full access"
                                        : p.privileges[m]}
                                    </b>
                                  </div>
                                ))}
                              </div>
                              <footer>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    open({ kind: "permissions", person: p })
                                  }
                                >
                                  Atur akses
                                </Button>
                                {p.status === "active" &&
                                  p.role !== "admin" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        if (
                                          confirm(
                                            `Deactivate ${p.name}? Session berikutnya akan ditolak.`,
                                          )
                                        )
                                          run({
                                            action: "deactivate",
                                            id: p.id,
                                            version: p.version,
                                          });
                                      }}
                                    >
                                      Deactivate
                                    </Button>
                                  )}
                              </footer>
                            </article>
                          ))}
                        </div>
                        <h2 className="spaced-heading">Invitations</h2>
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Nama</th>
                                <th>Email</th>
                                <th>Status invitation</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {s.invitations.map((i) => (
                                <tr key={i.id}>
                                  <td>{i.name}</td>
                                  <td>{i.email}</td>
                                  <td>
                                    <span className="tag neutral">
                                      {i.status === "sent" &&
                                      i.delivery_channel === "manual"
                                        ? "Link siap"
                                        : i.status}
                                    </span>
                                  </td>
                                  <td>
                                    {!["accepted", "revoked"].includes(
                                      i.status,
                                    ) && (
                                      <div className="row-actions">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            open({
                                              kind: "permissions",
                                              invitation: i,
                                            })
                                          }
                                        >
                                          Atur akses
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={busy}
                                          onClick={() =>
                                            run({
                                              action: "resend_invite",
                                              id: i.id,
                                            })
                                          }
                                        >
                                          Generate ulang
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            if (
                                              confirm("Revoke invitation ini?")
                                            )
                                              run({
                                                action: "revoke_invite",
                                                id: i.id,
                                              });
                                          }}
                                        >
                                          Revoke
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {!s.invitations.length && (
                            <Empty text="Belum ada invitation. Member bergabung melalui invitation admin." />
                          )}
                        </div>
                        {s.reassignment.length > 0 && (
                          <>
                            <h2 className="spaced-heading">
                              Task perlu reassignment
                            </h2>
                            <div className="notice">
                              Assignee berikut sudah tidak memiliki akses
                              parent.
                            </div>
                            {s.reassignment.map((t) => (
                              <div className="task-row" key={t.id}>
                                <span>{t.title}</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    open({
                                      kind: "task",
                                      task: t,
                                      context: t.context,
                                    })
                                  }
                                >
                                  Reassign
                                </Button>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )
          )}
          {loading && s && (
            <div className="refresh-indicator" role="status">
              Memuat perubahan…
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>travelOS · Egimu Travel</span>
          <span>
            Local timezone · {s?.timezone || "Local time"}{" "}
            <span className="status-dot tone-1" />
          </span>
        </footer>
      </div>
      {editor && s && (
        <Forms
          key={
            editor.kind +
            (editor.journey?.id ||
              editor.task?.id ||
              editor.transaction?.id ||
              editor.person?.id ||
              "")
          }
          editor={editor}
          snapshot={s}
          error={error}
          busy={busy}
          onClose={() => {
            if (!busy) {
              setEditor(null);
              setError("");
            }
          }}
          onSubmit={run}
        />
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  icon: Icon,
  text,
  warn = false,
}: {
  label: string;
  value: string;
  icon: typeof LayoutGrid;
  text: string;
  warn?: boolean;
}) {
  return (
    <article className={"stat-card " + (warn ? "warm" : "")}>
      <div>
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <small>{text}</small>
    </article>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <Compass size={26} />
      <p>{text}</p>
    </div>
  );
}
export function Pagination({
  count,
  page,
  onPage,
}: {
  count: number;
  page: number;
  onPage: (p: number) => void;
}) {
  if (count <= 50) return null;
  return (
    <div className="pagination">
      <small>
        {page * 50 + 1}–{Math.min((page + 1) * 50, count)} dari {count}
      </small>
      <Button
        variant="outline"
        size="sm"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft size={15} />
        Sebelumnya
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={(page + 1) * 50 >= count}
        onClick={() => onPage(page + 1)}
      >
        Berikutnya
        <ChevronRight size={15} />
      </Button>
    </div>
  );
}
export function CashStats({ s, period }: { s: Snapshot; period: string }) {
  return (
    <>
      <div className="cash-period">
        Cash movement · <b>{period}</b> · Void tidak dihitung
      </div>
      <div className="cash-grid">
        <Stat
          label="Money In"
          value={moneyLabel(s.totals.moneyIn)}
          icon={ArrowDownLeft}
          text="Kas diterima"
        />
        <Stat
          label="Money Out"
          value={moneyLabel(s.totals.moneyOut)}
          icon={ArrowUpRight}
          text="Kas dibayarkan"
        />
        <Stat
          label="Hasil kas / Net Cash Result"
          value={moneyLabel(s.totals.net)}
          icon={Wallet}
          text="Money In − Money Out"
        />
      </div>
    </>
  );
}
export function FinanceFilters({
  s,
  filters: f,
  onFilter,
  onAllTime,
}: {
  s: Snapshot;
  filters: Filters;
  onFilter: (k: keyof Filters, v: string) => void;
  onAllTime: () => void;
}) {
  return (
    <div className="finance-filters">
      <label>
        Dari
        <input
          type="date"
          aria-label="Tanggal dari"
          value={f.from || ""}
          onChange={(e) => onFilter("from", e.target.value)}
        />
      </label>
      <label>
        Sampai
        <input
          type="date"
          aria-label="Tanggal sampai"
          value={f.to || ""}
          onChange={(e) => onFilter("to", e.target.value)}
        />
      </label>
      <select
        aria-label="Direction filter"
        value={f.direction || ""}
        onChange={(e) => onFilter("direction", e.target.value)}
      >
        <option value="">Semua direction</option>
        <option value="in">Money In</option>
        <option value="out">Money Out</option>
      </select>
      <select
        aria-label="Category filter"
        value={f.category || ""}
        onChange={(e) => onFilter("category", e.target.value)}
      >
        <option value="">Semua category</option>
        {s.categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Trip filter"
        value={f.trip || ""}
        onChange={(e) => onFilter("trip", e.target.value)}
      >
        <option value="">Semua context</option>
        <option value="general">General</option>
        {s.journeys.map((j) => (
          <option key={j.id} value={j.id}>
            {j.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Status filter"
        value={f.status || "posted"}
        onChange={(e) => onFilter("status", e.target.value)}
      >
        <option value="posted">Posted</option>
        <option value="void">Void</option>
        <option value="all">Semua status</option>
      </select>
      <input
        aria-label="Cari transaksi"
        placeholder="Cari deskripsi…"
        value={f.search || ""}
        onChange={(e) => onFilter("search", e.target.value)}
      />
      <Button size="sm" variant="ghost" onClick={onAllTime}>
        All time / reset
      </Button>
    </div>
  );
}
export function Ledger({
  s,
  canEdit,
  onEdit,
}: {
  s: Snapshot;
  canEdit: boolean;
  onEdit: (e: Editor) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Direction / Category</th>
            <th>Amount IDR</th>
            <th>Trip / General</th>
            <th>Deskripsi</th>
            <th>Status / Entered by</th>
            {canEdit && <th />}
          </tr>
        </thead>
        <tbody>
          {s.transactions.map((t) => (
            <tr key={t.id}>
              <td>{shortDate(t.date)}</td>
              <td>
                <span className={"ledger-direction " + t.direction}>
                  {t.direction === "in" ? (
                    <ArrowDownLeft size={13} />
                  ) : (
                    <ArrowUpRight size={13} />
                  )}
                  Money {t.direction === "in" ? "In" : "Out"}
                </span>
                <small>
                  {s.categories.find((c) => c.id === t.category)?.name}
                </small>
              </td>
              <td className="amount-cell">{moneyLabel(t.amount)}</td>
              <td>
                {t.trip
                  ? s.journeys.find((j) => j.id === t.trip)?.name || "Trip"
                  : "General"}
              </td>
              <td className="description-cell">{t.description}</td>
              <td>
                <span
                  className={
                    "tag " + (t.status === "void" ? "neutral" : "trip")
                  }
                >
                  {t.status}
                </span>
                <small>
                  {s.people.find((p) => p.id === t.created_by)?.name}
                </small>
              </td>
              {canEdit && (
                <td>
                  {t.status === "posted" &&
                    (!t.trip || can(s.user, "trips")) && (
                      <div className="row-actions">
                        <button
                          className="text-button tiny"
                          onClick={() =>
                            onEdit({ kind: "transaction", transaction: t })
                          }
                        >
                          Koreksi
                        </button>
                        <button
                          className="text-button tiny negative"
                          onClick={() =>
                            onEdit({ kind: "void", transaction: t })
                          }
                        >
                          Void
                        </button>
                      </div>
                    )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!s.transactions.length && (
        <Empty text="Belum ada transaksi pada filter ini. Mulai dengan Money In atau Money Out." />
      )}
    </div>
  );
}
