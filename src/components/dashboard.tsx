"use client";
import { SelectionTable } from "./selection-table";
import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText,
  CircleHelp,
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
import { PlatformCredit, PlatformFooter } from "./platform-credit";
import { Budget } from "./p2";
import { InternalDocs } from "./internal-docs";
import { InternalContacts } from "./internal-contacts";
import { ClickableRow } from "./clickable-row";
import { BreadcrumbPicker } from "./breadcrumb-picker";
import { TransactionDetail } from "./transaction-detail";
import { Toast } from "./toast";
import { SubmissionReview } from "./submission-review";
import { Corrections } from "./corrections";
import { CashOverview } from "./cash-overview";
import { localTimezone, dateInZone } from "@/lib/time";
import {
  Calendar,
  SalesAnalytics,
  Comparison,
  Configuration,
  AuditViewer,
} from "./p1";
export function Dashboard() {
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const path = usePathname(),
    router = useRouter();
  const parts = path.split("/").filter(Boolean);
  const view =
    parts[0] === "settings"
      ? ["configuration", "audit"].includes(parts[1])
        ? parts[1]
        : "people"
      : ["sales", "trips", "finance", "docs"].includes(parts[0])
        ? parts[0]
        : "home";
  const recordId =
    parts[1] &&
    parts[1] !== "archive" &&
    ["sales", "trips", "docs"].includes(parts[0])
      ? parts[1]
      : undefined;
  const archive = ["/sales/archive", "/trips/archive"].includes(path);
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
    [internalTab, setInternalTab] = useState("docs"),
    [appliedFilters, setAppliedFilters] = useState<Filters>({}),
    [dirty, setDirty] = useState(false);
  const requestSequence = useRef(0),
    activeRequest = useRef<AbortController | null>(null),
    sending = useRef(false);
  const effective = {
    ...filters,
    ...(archive ? { lifecycle: "archive" } : {}),
  };
  const fetchState = useCallback(async () => {
    if (auth) return;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
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
      const r = await fetch("/api/workspace?" + q, {
        cache: "no-store",
        signal: controller.signal,
      });
      const d = await r.json();
      if (seq !== requestSequence.current) return;
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) {
          setS(null);
          setEditor(null);
          setDirty(false);
        }
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
      if (!controller.signal.aborted && seq === requestSequence.current) {
        setError((e as Error).message);
      }
    } finally {
      if (seq === requestSequence.current) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }, [view, recordId, JSON.stringify(filters), archive, auth, router]);
  useEffect(() => {
    void fetchState();
    return () => {
      requestSequence.current++;
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [fetchState]);
  useEffect(() => {
    const refreshLocalDay = () => {
      if (
        s &&
        document.visibilityState === "visible" &&
        !activeRequest.current &&
        !editor &&
        !busy &&
        !dirty &&
        (["home", "trips"].includes(view) ||
          s.today !== dateInZone() ||
          s.timezone !== localTimezone())
      )
        void fetchState();
    };
    const timer = window.setInterval(refreshLocalDay, 60000);
    window.addEventListener("focus", refreshLocalDay);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshLocalDay);
    };
  }, [s?.today, s?.timezone, fetchState, dirty, editor, busy, view]);
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
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!response.ok) throw Error((await response.json()).error);
      requestSequence.current++;
      activeRequest.current?.abort();
      setS(null);
      setEditor(null);
      setDirty(false);
      router.replace("/login");
    } catch (error) {
      setError((error as Error).message || "Logout belum berhasil. Coba lagi.");
    }
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
    !["home", "sales", "trips", "finance", "docs", "settings"].includes(
      parts[0] || "home",
    ) ||
    (parts[0] === "settings" &&
      (!["people", "configuration", "audit"].includes(parts[1]) ||
        parts.length !== 2)) ||
    (["home", "finance"].includes(parts[0]) && parts.length > 1) ||
    (["sales", "trips", "docs"].includes(parts[0]) && parts.length > 2)
  )
    return (
      <div className="auth-page">
        <h1>Halaman tidak ditemukan.</h1>
        <PlatformFooter />
        <Button onClick={() => navigate("/home")}>Ke Home</Button>
      </div>
    );
  const title = {
    home: "Home",
    sales: "Sales CRM",
    trips: "Trips",
    finance: "Finance",
    docs: "Internal",
    people: "People",
    configuration: "Configuration",
    audit: "Audit history",
  }[view];
  const j = s?.journeys.find((j) => j.id === recordId);
  const settingsDenied = parts[0] === "settings" && s?.user.role === "member";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-main">
        Langsung ke konten
      </a>
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
            { id: "docs", label: "Internal", icon: FileText },
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
                  <span className="nav-count">{s?.homeTaskCount ?? 0}</span>
                )}
              </button>
            ))}
        </nav>
        {s && s.user.role === "admin" && (
          <>
            <span className="nav-label">TEAM & SETTINGS</span>
            <nav>
              {s.user.role === "admin" && (
                <button
                  className={view === "people" ? "active" : ""}
                  onClick={() => navigate("/settings/people")}
                >
                  <Users size={18} />
                  People
                </button>
              )}
              {["sales", "trips", "finance", "docs"].some((m) =>
                can(s.user, m as Module, true),
              ) && (
                <button
                  className={view === "configuration" ? "active" : ""}
                  onClick={() => navigate("/settings/configuration")}
                >
                  <Settings size={18} />
                  Configuration
                </button>
              )}
              {["sales", "trips", "finance", "docs"].some((m) =>
                can(s.user, m as Module),
              ) && (
                <button
                  className={view === "audit" ? "active" : ""}
                  onClick={() => navigate("/settings/audit")}
                >
                  <ShieldCheck size={18} />
                  Audit history
                </button>
              )}
            </nav>
          </>
        )}
        <div className="sidebar-bottom">
          <a className="help-nav-link" href="/help">
            <CircleHelp size={18} />
            Bantuan penggunaan
          </a>
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
            <button
              className="breadcrumb-home"
              onClick={() => navigate("/home")}
            >
              Workspace
            </button>
            <Right size={13} />
            {s ? (
              <BreadcrumbPicker
                label={title || "Workspace"}
                navigate={navigate}
                options={[
                  { label: "Home", url: "/home" },
                  ...(["sales", "trips", "finance", "docs"] as Module[])
                    .filter((m) => can(s.user, m))
                    .map((m) => ({
                      label: {
                        sales: "Sales CRM",
                        trips: "Trips",
                        finance: "Finance",
                        docs: "Internal",
                      }[m],
                      url: "/" + m,
                    })),
                  ...(s.user.role === "admin"
                    ? [{ label: "People", url: "/settings/people" }]
                    : []),
                  ...(s.user.role === "admin" &&
                  (["sales", "trips", "finance", "docs"] as Module[]).some(
                    (m) => can(s.user, m, true),
                  )
                    ? [
                        {
                          label: "Configuration",
                          url: "/settings/configuration",
                        },
                      ]
                    : []),
                  ...(s.user.role === "admin" &&
                  (["sales", "trips", "finance", "docs"] as Module[]).some(
                    (m) => can(s.user, m),
                  )
                    ? [{ label: "Audit history", url: "/settings/audit" }]
                    : []),
                ]}
              />
            ) : (
              <b>{title}</b>
            )}
            {(j || s?.documents?.some((d) => d.id === recordId)) && (
              <>
                <Right size={13} />
                <BreadcrumbPicker
                  label={
                    j
                      ? j.name || j.client
                      : s?.documents?.find((d) => d.id === recordId)?.title ||
                        "Document"
                  }
                  view={view as "sales" | "trips" | "docs"}
                  navigate={navigate}
                />
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
        <main id="workspace-main" tabIndex={-1} className="workspace-content">
          {settingsDenied && (
            <Empty text="Team & Settings hanya tersedia untuk admin." />
          )}
          {loading && s && <Toast pending message="Memuat hasil terbaru..." />}
          {notice && !loading && (
            <Toast message={notice} onClose={() => setNotice("")} />
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
            s &&
            !settingsDenied && (
              <>
                {view === "docs" && recordId ? (
                  s.documents?.find((d) => d.id === recordId) ? (
                    <InternalDocs
                      key={recordId}
                      s={s}
                      document={s.documents.find((d) => d.id === recordId)}
                      run={run}
                      busy={busy}
                      navigate={navigate}
                      onDirty={setDirty}
                    />
                  ) : (
                    <Empty text="Dokumen tidak ditemukan." />
                  )
                ) : recordId && j ? (
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
                              ? view === "trips"
                                ? "Trip archive"
                                : "Lead archive"
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
                                        : view === "docs"
                                          ? "Catatan dan pengetahuan tim."
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
                                    ? "Catat Income / Receipts dan Expense / Payments. Satu ledger, dalam IDR."
                                    : view === "configuration"
                                      ? "Sesuaikan tahapan Sales, kategori kas, dan template perjalanan."
                                      : view === "audit"
                                        ? "Telusuri tindakan penting dan koreksi tanpa mengubah riwayat."
                                        : view === "docs"
                                          ? "Dokumen internal, template, dan catatan dalam satu tempat."
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
                            Task pribadi
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
                        {view === "trips" && (
                          <>
                            <Button
                              variant="outline"
                              onClick={() =>
                                navigate(archive ? "/trips" : "/trips/archive")
                              }
                            >
                              <FolderArchive size={16} />
                              {archive ? "Active board" : "Archive"}
                            </Button>
                            {!archive && can(s.user, "trips", true) && (
                              <Button
                                onClick={() =>
                                  open({ kind: "journey", context: "trip" })
                                }
                              >
                                <Plus size={16} />
                                Trip baru
                              </Button>
                            )}
                          </>
                        )}
                        {view === "finance" && can(s.user, "finance", true) && (
                          <Button onClick={() => open({ kind: "transaction" })}>
                            <Plus size={16} />
                            Record transaction
                          </Button>
                        )}
                        {view === "people" && (
                          <Button onClick={() => open({ kind: "invite" })}>
                            <Plus size={16} />
                            Undang member
                          </Button>
                        )}
                      </div>
                    </section>
                    {view === "docs" && (
                      <>
                        <div
                          className="detail-tabs"
                          role="tablist"
                          aria-label="Internal"
                        >
                          {["docs", "contacts"].map((tab) => (
                            <button
                              key={tab}
                              role="tab"
                              aria-selected={internalTab === tab}
                              className={internalTab === tab ? "selected" : ""}
                              onClick={() => {
                                if (
                                  dirty &&
                                  !confirm("Buang perubahan belum disimpan?")
                                )
                                  return;
                                setDirty(false);
                                setInternalTab(tab);
                              }}
                            >
                              {tab === "docs" ? "Docs" : "Contacts"}
                            </button>
                          ))}
                        </div>
                        {internalTab === "contacts" ? (
                          <InternalContacts
                            s={s}
                            run={run}
                            busy={busy}
                            onDirty={setDirty}
                          />
                        ) : (
                          <>
                            <div className="internal-docs-toolbar">
                              <label className="search-box internal-docs-search">
                                <Search size={16} />
                                <input
                                  aria-label="Cari dokumen"
                                  placeholder="Cari judul atau category…"
                                  value={filters.search || ""}
                                  onChange={(e) =>
                                    filter("search", e.target.value)
                                  }
                                />
                              </label>
                            </div>
                            <InternalDocs
                              key="docs-list"
                              filters={filters}
                              onFilter={filter}
                              s={s}
                              run={run}
                              busy={busy}
                              navigate={navigate}
                              onDirty={setDirty}
                            />
                            <Pagination
                              count={s.count}
                              page={Number(filters.page || 0)}
                              onPage={(p) => filter("page", String(p))}
                            />
                          </>
                        )}
                      </>
                    )}
                    {view === "home" && (
                      <>
                        <div className="summary-grid">
                          <Stat
                            label="Perlu dikerjakan"
                            value={String(s.taskCounts.Assigned || 0)}
                            icon={LayoutGrid}
                            text="Tasks assigned"
                          />
                          <Stat
                            label="Sedang dikerjakan"
                            value={String(s.taskCounts.Doing || 0)}
                            icon={Clock3}
                            text="Tasks doing"
                          />
                          <Stat
                            label="Selesai"
                            value={String(s.taskCounts.Done || 0)}
                            icon={CheckCircle2}
                            text="Tasks done"
                          />
                          <Stat
                            label="Perlu perhatian"
                            value={String(
                              s.tasks.filter((t) =>
                                ["Overdue", "Due today", "Due soon"].includes(
                                  deadline(t, s.today),
                                ),
                              ).length,
                            )}
                            icon={CalendarDays}
                            text="Deadline sudah dekat / terlewat"
                            warn
                          />
                        </div>
                        <div className="section-toolbar">
                          <div>
                            <h2>
                              Tasks Overview{" "}
                              <span className="subtle-count">
                                {s.tasks.length}
                              </span>
                            </h2>
                            <p>Dikumpulkan dari Internal, Sales, dan Trips.</p>
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
                            <SelectionTable>
                              <thead>
                                <tr>
                                  <th>
                                    {view === "trips" ? "Trip" : "Opportunity"}
                                  </th>
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
                                          navigate(`/${view}/${j.id}`)
                                        }
                                      >
                                        {j.name || j.client}
                                      </button>
                                      <small>{j.client}</small>
                                    </td>
                                    <td>
                                      <span className="tag">
                                        {view === "trips"
                                          ? j.stage
                                          : j.lifecycle}
                                      </span>
                                    </td>
                                    <td>{shortDate(j.archived_at || "")}</td>
                                    <td>{j.lost_reason || "—"}</td>
                                    <td>
                                      {j.kind === "lead" &&
                                        j.lifecycle !== "converted" &&
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
                            </SelectionTable>
                            {!s.journeys.length && (
                              <Empty
                                text={`Belum ada ${view === "trips" ? "trip" : "lead"} di archive.`}
                              />
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
                                : s.tripStages
                                    ?.filter(
                                      (x) => x.active && x.semantic === "open",
                                    )
                                    .map((x) => x.id) || tripStages
                            }
                            labels={Object.fromEntries(
                              (view === "sales"
                                ? s.salesStages || []
                                : s.tripStages || []
                              ).map((x) => [x.id, x.label]),
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
                            <button
                              aria-label="Budget vs actual"
                              className={
                                financeTab === "budget" ? "selected" : ""
                              }
                              onClick={() => setFinanceTab("budget")}
                            >
                              Budget
                            </button>
                          </div>
                          {can(s.user, "finance") && (
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
                        {!["comparison", "budget"].includes(financeTab) && (
                          <FinanceFilters
                            s={s}
                            filters={filters}
                            onFilter={filter}
                            onAllTime={() => setFilters({ status: "posted" })}
                          />
                        )}
                        {!["comparison", "budget"].includes(financeTab) && (
                          <CashStats
                            s={s}
                            period={periodLabel(appliedFilters)}
                          />
                        )}
                        {financeTab === "budget" ? (
                          <Budget s={s} run={run} busy={busy} />
                        ) : financeTab === "comparison" ? (
                          <Comparison s={s} />
                        ) : financeTab === "transactions" ? (
                          <>
                            <SubmissionReview s={s} run={run} busy={busy} />
                            <Corrections s={s} run={run} busy={busy} />
                            <Ledger
                              s={s}
                              run={run}
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
                          <CashOverview rows={s.cashRows} />
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
                        <div className="filter-row">
                          <label>
                            Dari
                            <input
                              type="date"
                              aria-label="Audit dari"
                              value={filters.from || ""}
                              onChange={(e) => filter("from", e.target.value)}
                            />
                          </label>
                          <label>
                            Sampai
                            <input
                              type="date"
                              aria-label="Audit sampai"
                              value={filters.to || ""}
                              onChange={(e) => filter("to", e.target.value)}
                            />
                          </label>
                          <label>
                            Actor
                            <select
                              aria-label="Audit actor"
                              value={filters.actor || ""}
                              onChange={(e) => filter("actor", e.target.value)}
                            >
                              <option value="">Semua actor</option>
                              {s.people.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Action
                            <input
                              aria-label="Audit action"
                              placeholder="Contoh: save_budget"
                              value={filters.action || ""}
                              onChange={(e) => filter("action", e.target.value)}
                            />
                          </label>
                          <Button
                            variant="ghost"
                            onClick={() => setFilters({})}
                          >
                            Reset
                          </Button>
                        </div>
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
                          <div className="bulk-toolbar">
                            <label>
                              <input
                                type="checkbox"
                                aria-label="Pilih semua anggota"
                                checked={
                                  s.people.filter(
                                    (p) =>
                                      p.status === "active" &&
                                      p.id !== s.user.id,
                                  ).length > 0 &&
                                  s.people
                                    .filter(
                                      (p) =>
                                        p.status === "active" &&
                                        p.id !== s.user.id,
                                    )
                                    .every((p) => selectedPeople.includes(p.id))
                                }
                                onChange={(e) =>
                                  setSelectedPeople(
                                    e.target.checked
                                      ? s.people
                                          .filter(
                                            (p) =>
                                              p.status === "active" &&
                                              p.id !== s.user.id,
                                          )
                                          .map((p) => p.id)
                                      : [],
                                  )
                                }
                              />{" "}
                              Pilih semua anggota
                            </label>
                            <Button
                              size="sm"
                              disabled={!selectedPeople.length || busy}
                              onClick={async () => {
                                if (
                                  !confirm(
                                    `Deactivate ${selectedPeople.length} anggota?`,
                                  )
                                )
                                  return;
                                if (
                                  await run({
                                    action: "bulk_action",
                                    data: {
                                      commands: s.people
                                        .filter((p) =>
                                          selectedPeople.includes(p.id),
                                        )
                                        .map((p) => ({
                                          action: "deactivate",
                                          id: p.id,
                                          version: p.version,
                                        })),
                                    },
                                  })
                                )
                                  setSelectedPeople([]);
                              }}
                            >
                              Deactivate terpilih
                            </Button>
                          </div>
                          {s.people.map((p) => (
                            <article className="person-card" key={p.id}>
                              <div className="person-card-head">
                                <input
                                  type="checkbox"
                                  aria-label={`Pilih anggota ${p.name}`}
                                  disabled={
                                    busy ||
                                    p.status !== "active" ||
                                    p.id === s.user.id
                                  }
                                  checked={selectedPeople.includes(p.id)}
                                  onChange={(e) =>
                                    setSelectedPeople((prev) =>
                                      e.target.checked
                                        ? [...prev, p.id]
                                        : prev.filter((id) => id !== p.id),
                                    )
                                  }
                                />
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
                                  [
                                    "sales",
                                    "trips",
                                    "finance",
                                    "docs",
                                  ] as Module[]
                                ).map((m) => (
                                  <div key={m}>
                                    <span>{m}</span>
                                    <b>{p.privileges[m] || "none"}</b>
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
                                  p.id !== s.user.id && (
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
                          <SelectionTable
                            actionLabel="Revoke terpilih"
                            onDelete={
                              s.user.role === "admin"
                                ? async (ids) => {
                                    const invitations = s.invitations.filter(
                                      (i) =>
                                        ids.includes(i.id) &&
                                        !["accepted", "revoked"].includes(
                                          i.status,
                                        ),
                                    );
                                    if (!invitations.length) return false;
                                    return run({
                                      action: "bulk_action",
                                      data: {
                                        commands: invitations.map((i) => ({
                                          action: "revoke_invite",
                                          id: i.id,
                                          version: i.version,
                                        })),
                                      },
                                    });
                                  }
                                : undefined
                            }
                          >
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
                          </SelectionTable>
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
        </main>
        <footer className="app-footer">
          <PlatformCredit />
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
          label="Income / Receipts"
          value={moneyLabel(s.totals.moneyIn)}
          icon={ArrowDownLeft}
          text="Kas diterima"
        />
        <Stat
          label="Expenses / Payments"
          value={moneyLabel(s.totals.moneyOut)}
          icon={ArrowUpRight}
          text="Kas dibayarkan"
        />
        <Stat
          label="Hasil kas / Net Cash Result"
          value={moneyLabel(s.totals.net)}
          icon={Wallet}
          text="Penerimaan kas − Pengeluaran kas"
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
        <option value="in">Income / Receipts</option>
        <option value="out">Expense / Payments</option>
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
        placeholder="Cari judul atau catatan…"
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
  run,
}: {
  s: Snapshot;
  canEdit: boolean;
  onEdit: (e: Editor) => void;
  run?: (c: Command) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const transaction = s.transactions.find((t) => t.id === selected);
  return (
    <>
      <div className="table-wrap finance-table">
        <SelectionTable
          actionLabel="Void terpilih"
          readOnlyReason="Void transaksi hanya untuk admin Finance."
          onDelete={
            run && s.user.role === "admin" && can(s.user, "finance")
              ? async (ids) => {
                  const reason = prompt("Alasan void transaksi terpilih:");
                  if (!reason?.trim()) return false;
                  const rows = s.transactions.filter(
                    (t) => ids.includes(t.id) && t.status === "posted",
                  );
                  if (!rows.length) return false;
                  return run({
                    action: "bulk_action",
                    data: {
                      commands: rows.map((t) => ({
                        action: "void_transaction",
                        id: t.id,
                        version: t.version,
                        data: { reason },
                      })),
                    },
                  });
                }
              : undefined
          }
        >
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Judul / Category</th>
              <th className="amount-cell">Amount IDR</th>
              <th>Context</th>
              <th>Status / Creator</th>
            </tr>
          </thead>
          <tbody>
            {s.transactions.map((t) => {
              const pending = s.corrections?.some(
                (c) => c.transaction_id === t.id,
              );
              return (
                <ClickableRow
                  key={t.id}
                  label={`Buka transaksi ${t.title || "Transaksi"}`}
                  onOpen={() => setSelected(t.id)}
                  className={t.status === "void" ? "void-row" : ""}
                >
                  <td className="ledger-date">{shortDate(t.date)}</td>
                  <td className="ledger-title">
                    <button
                      className="table-link"
                      onClick={() => setSelected(t.id)}
                    >
                      {t.title || "Transaksi"}
                    </button>
                    <small>
                      {s.categories.find((c) => c.id === t.category)?.name}
                    </small>
                  </td>
                  <td
                    className={`amount-cell ${t.status === "void" ? "muted" : t.direction === "in" ? "positive" : "negative"}`}
                  >
                    <span
                      aria-label={t.direction === "in" ? "Receipt" : "Payment"}
                    >
                      {t.direction === "in" ? "+" : "−"}
                      {moneyLabel(t.amount)}
                    </span>
                  </td>
                  <td>
                    {t.trip
                      ? s.journeys.find((j) => j.id === t.trip)?.name || "Trip"
                      : "General"}
                  </td>
                  <td>
                    <span
                      className={`tag ${t.status === "void" ? "neutral" : pending ? "lead" : "trip"}`}
                    >
                      {pending ? "Pending correction" : t.status}
                    </span>
                    <small>
                      {s.people.find((p) => p.id === t.created_by)?.name}
                    </small>
                  </td>
                </ClickableRow>
              );
            })}
          </tbody>
        </SelectionTable>
        {!s.transactions.length && (
          <Empty text="Belum ada transaksi pada filter ini. Gunakan Record transaction untuk mencatat penerimaan atau pengeluaran." />
        )}
      </div>
      {transaction && (
        <TransactionDetail
          transaction={transaction}
          snapshot={s}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
          onEdit={onEdit}
        />
      )}
    </>
  );
}
