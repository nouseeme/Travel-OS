import { z } from "zod";
import { minorUnits, decimalString, formatIDR, MAX_IDR } from "./money";
import {
  type Person,
  type Module,
  type Journey,
  type Task,
  type Transaction,
  type Category,
  type Filters,
  categories,
} from "./model";

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function allow(user: Person, module: Module, edit = false) {
  return (
    user.status === "active" &&
    (edit
      ? user.privileges[module] === "edit"
      : ["view", "edit"].includes(user.privileges[module] || "none"))
  );
}
export function requireAccess(user: Person, module?: Module, edit = false) {
  if (user.status !== "active" || (module && !allow(user, module, edit)))
    throw new AppError(
      "Akses ditolak. Hubungi admin untuk privilege yang diperlukan.",
      403,
    );
}
export function todayIn(timezone = "UTC", now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function dueLabel(task: Pick<Task, "due" | "status">, today: string) {
  if (!task.due || task.status === "Done") return "";
  const delta = (Date.parse(task.due) - Date.parse(today)) / 86400000;
  return delta < 0
    ? "Overdue"
    : delta === 0
      ? "Due today"
      : delta <= 2
        ? "Due soon"
        : "";
}
export function rupiah(amount: string | bigint) {
  return formatIDR(String(amount || "0"));
}
export function money(value: unknown, positive = true) {
  if (
    typeof value !== "string" ||
    !/^\d+(\.\d{1,2})?$/.test(value) ||
    minorUnits(value) > MAX_IDR ||
    (positive && minorUnits(value) < 1n)
  )
    throw new AppError(
      "Masukkan nominal IDR positif dengan maksimal 2 desimal.",
    );
  return decimalString(minorUnits(value));
}
export function date(value: unknown, required = true) {
  if (!value && !required) return "";
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new AppError("Tanggal tidak valid.");
  return value;
}
const text = (v: unknown, label: string, required = false, max = 5000) => {
  if (v === undefined || v === null) v = "";
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    throw new AppError(`${label} tidak valid.`);
  return v.trim();
};
const id = z.uuid();
const notesSchema = z
  .array(
    z.object({
      id,
      title: z.string().trim().min(1).max(120),
      body: z.string().max(50000),
    }),
  )
  .max(30);
const contactsSchema = z
  .array(
    z.object({
      id,
      version: z.number().int().positive().optional(),
      name: z.string().trim().min(1).max(200),
      role: z.string().max(200),
      organization: z.string().max(200),
      phone: z.string().max(80),
      email: z.union([z.email(), z.literal("")]),
      note: z.string().max(5000),
    }),
  )
  .max(100);
const daysSchema = z
  .array(
    z.object({
      id,
      title: z.string().max(200),
      items: z
        .array(
          z.object({
            id,
            name: z.string().trim().min(1).max(200),
            description: z.string().max(10000),
          }),
        )
        .max(100),
    }),
  )
  .min(1)
  .max(90);
export function validateContent(data: Record<string, unknown>) {
  for (const [key, schema] of [
    ["notes", notesSchema],
    ["contacts", contactsSchema],
    ["days", daysSchema],
  ] as const) {
    if (key in data) {
      const result = schema.safeParse(data[key]);
      if (!result.success)
        throw new AppError(`${key}: ${result.error.issues[0]?.message}`);
      const ids =
        key === "days"
          ? result.data.flatMap((d) => [
              d.id,
              ...("items" in d
                ? (d.items as { id: string }[]).map((x) => x.id)
                : []),
            ])
          : result.data.map((x) => x.id);
      if (new Set(ids).size !== ids.length)
        throw new AppError("ID konten tidak boleh duplikat.");
    }
  }
}
export function transactionMatches(t: Transaction, f: Filters) {
  return (
    (!f.from || t.date >= f.from) &&
    (!f.to || t.date <= f.to) &&
    (!f.direction || t.direction === f.direction) &&
    (!f.category || t.category === f.category) &&
    (!f.trip || (f.trip === "general" ? !t.trip : t.trip === f.trip)) &&
    (!f.status || f.status === "all" || t.status === f.status) &&
    (!f.search ||
      `${t.title || ""} ${t.description}`
        .toLowerCase()
        .includes(f.search.toLowerCase()))
  );
}
export function totals(rows: Transaction[]) {
  let a = 0n,
    b = 0n;
  for (const t of rows)
    if (t.status === "posted")
      t.direction === "in"
        ? (a += minorUnits(t.amount))
        : (b += minorUnits(t.amount));
  return {
    moneyIn: decimalString(a),
    moneyOut: decimalString(b),
    net: decimalString(a - b),
  };
}
export function csvCell(v: unknown) {
  let s = String(v ?? "");
  if (/^\s*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function csv(
  rows: Transaction[],
  journeys: Journey[],
  people: Person[],
  categoryRows: Category[] = categories,
) {
  return (
    "\uFEFF" +
    [
      [
        "ID",
        "Transaction date",
        "Direction",
        "Amount IDR",
        "Category",
        "Trip",
        "Title",
        "Description",
        "Status",
        "Created by",
        "Created at",
        "Updated at",
        "Void by",
        "Void at",
        "Reason",
      ],
      ...rows.map((t) => [
        t.id,
        t.date,
        t.direction,
        t.amount,
        categoryRows.find((c) => c.id === t.category)?.name,
        t.trip
          ? journeys.find((j) => j.id === t.trip)?.name || t.trip
          : "General",
        t.title || "",
        t.description,
        t.status,
        people.find((p) => p.id === t.created_by)?.name,
        t.created_at,
        t.updated_at,
        t.void_by,
        t.void_at,
        t.reason,
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n")
  );
}
