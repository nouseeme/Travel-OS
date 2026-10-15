export type Module = "sales" | "trips" | "finance" | "docs";
export type Level = "none" | "view" | "edit";
export type Privileges = Record<Exclude<Module, "docs">, Level> & {
  docs?: Level;
};
export interface Person {
  id: string;
  version: number;
  name: string;
  email: string;
  role: "admin" | "member";
  status: "active" | "invited" | "deactivated";
  privileges: Privileges;
}
export interface Note {
  id: string;
  title: string;
  body: string;
}
export interface Contact {
  id: string;
  version?: number;
  name: string;
  role: string;
  organization: string;
  phone: string;
  email: string;
  note: string;
}
export interface DirectoryContact extends Contact {
  version?: number;
  source: string;
  source_id: string | null;
  source_kind: "internal" | "lead" | "trip";
  sources?: {
    label: string;
    id: string | null;
    kind: "internal" | "lead" | "trip";
  }[];
}
export interface Day {
  id: string;
  title: string;
  items: { id: string; name: string; description: string }[];
}
export interface RecordBase {
  id: string;
  version: number;
  created_at: string;
  updated_at: string;
}
export interface Journey extends RecordBase {
  kind: "lead" | "trip";
  name: string;
  client: string;
  pic: string;
  people: string[];
  stage: string;
  lifecycle: "active" | "lost" | "converted" | "archived";
  trip_type: string;
  client_type: string;
  start: string;
  end: string;
  guests: number | null;
  quote: string;
  notes: Note[];
  contacts: Contact[];
  days: Day[];
  source_lead: string | null;
  converted_trip: string | null;
  archived_at: string | null;
  lost_reason: string;
}
export interface Task extends RecordBase {
  title: string;
  description: string;
  status: "Assigned" | "Doing" | "Done";
  assignee: string;
  due: string;
  context: "internal" | "lead" | "trip";
  parent: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_by: string;
}
export interface Category {
  id: string;
  name: string;
  direction: "in" | "out";
  active?: boolean;
  version?: number;
}
export interface Transaction extends RecordBase {
  title?: string;
  date: string;
  direction: "in" | "out";
  amount: string;
  category: string;
  trip: string | null;
  description: string;
  status: "posted" | "void";
  created_by: string;
  void_by: string | null;
  void_at: string | null;
  reason: string;
  idempotency_key: string;
}
export interface InternalDoc extends RecordBase {
  title: string;
  date: string;
  creator: string;
  category: string;
  body: string;
}
export interface Correction extends RecordBase {
  original?: Transaction;
  transaction_id: string;
  requested_by: string;
  transaction_version: number;
  proposed: Transaction;
  reason: string;
  status: "pending" | "approved" | "rejected";
}
export interface Invitation {
  delivery_channel?: "email" | "manual";
  id: string;
  version: number;
  email: string;
  name: string;
  privileges: Privileges;
  status: "pending" | "sent" | "failed" | "accepted" | "revoked";
  provider_user: string | null;
  created_at: string;
  generation: string;
}
export interface Audit {
  id: string;
  actor: string;
  action: string;
  entity: string;
  at: string;
  metadata: Record<string, unknown>;
}
export interface State {
  people: Person[];
  invitations: Invitation[];
  journeys: Journey[];
  tasks: Task[];
  transactions: Transaction[];
  audit: Audit[];
  categories: Category[];
  timezone: string;
}
export interface Filters {
  sort?: "title" | "date" | "creator" | "category";
  order?: "asc" | "desc";
  title?: string;
  creator?: string;
  actor?: string;
  action?: string;
  budget_trip?: string;
  context?: string;
  period?: "month" | "quarter";
  anchor?: string;
  from?: string;
  to?: string;
  direction?: string;
  category?: string;
  trip?: string;
  status?: string;
  search?: string;
  assignee?: string;
  page?: string;
  lifecycle?: string;
  pic?: string;
}
export interface Snapshot {
  helpSettings?: { public: boolean; version: number };
  homeTaskCount?: number;
  contactDirectory?: DirectoryContact[];
  internalContacts?: { contacts: Contact[]; version: number };
  submissions?: import("./trip-sharing").Submission[];
  documents?: InternalDoc[];
  corrections?: Correction[];
  salesStages?: SalesStage[];
  tripStages?: (Omit<SalesStage, "key"> & {
    semantic: "open" | "completed" | "cancelled";
  })[];
  budgets?: BudgetRow[];
  templates?: Template[];
  tripView?: "board" | "calendar";
  audit?: Audit[];
  user: Person;
  people: Person[];
  invitations: Invitation[];
  journeys: Journey[];
  tasks: Task[];
  transactions: Transaction[];
  categories: Category[];
  timezone: string;
  today: string;
  demo: boolean;
  totals: { moneyIn: string; moneyOut: string; net: string };
  cashRows: {
    id: string;
    name: string;
    moneyIn: string;
    moneyOut: string;
    net: string;
  }[];
  count: number;
  taskCounts: Record<string, number>;
  reassignment: Task[];
}
export interface SalesStage {
  id: string;
  key: string;
  label: string;
  position: number;
  active: boolean;
  is_default: boolean;
  version: number;
}
export interface Template {
  id: string;
  name: string;
  kind: "lead_note" | "trip_note" | "itinerary" | "internal_doc";
  content:
    | string
    | { title: string; items: { name: string; description: string }[] }[];
  active: boolean;
  version: number;
}
export interface BudgetRow {
  trip: string;
  name: string;
  category: string;
  label: string;
  direction: "in" | "out";
  active: boolean;
  budget: string | null;
  version: number | null;
  actual: string;
  lifecycle: string;
}
export type Command = {
  action: string;
  id?: string;
  version?: number;
  data?: Record<string, unknown>;
};
export const stages = ["Drafts", "Contacted", "Prospect"];
export const tripStages = ["Planned", "Confirmed", "In Progress"];
export const taskStages = ["Assigned", "Doing", "Done"] as const;
export const noPrivileges: Privileges = {
  sales: "none",
  trips: "none",
  finance: "none",
  docs: "none",
};
export const categories: Category[] = [
  ...[
    "Uang muka pelanggan",
    "Pelunasan jasa perjalanan",
    "Pendapatan lain-lain",
    "Modal Pemilik",
    "Pinjaman Diterima",
  ].map((name, i) => ({ id: `in-${i}`, name, direction: "in" as const })),
  ...[
    "Beban transportasi",
    "Beban akomodasi",
    "Beban konsumsi",
    "Beban tiket dan aktivitas",
    "Beban jasa guide dan vendor",
    "Beban pemasaran",
    "Beban operasional",
    "Pengembalian dana pelanggan",
    "Penarikan Pemilik",
    "Pelunasan Pinjaman",
  ].map((name, i) => ({ id: `out-${i}`, name, direction: "out" as const })),
];
