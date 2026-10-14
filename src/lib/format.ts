import type { Task, Person, Module, Filters } from "./model";
import { localTimezone } from "./time";
import { formatIDR } from "./money";
export function periodLabel(f: Filters) {
  return f.from && f.to
    ? `${shortDate(f.from)} — ${shortDate(f.to)}`
    : f.from
      ? `Sejak ${shortDate(f.from)}`
      : f.to
        ? `Sampai ${shortDate(f.to)}`
        : "All time";
}
export const can = (u: Person, m: Module, edit = false) =>
  u.status === "active" &&
  (edit
    ? u.privileges[m] === "edit"
    : ["view", "edit"].includes(u.privileges[m] || "none"));
export const moneyLabel = formatIDR;
export const shortDate = (v: string) =>
  v
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: v.length === 10 ? "UTC" : localTimezone(),
      }).format(new Date(v.length === 10 ? v + "T00:00:00Z" : v))
    : "Tanpa tanggal";
export function deadline(t: Task, today: string) {
  if (!t.due || t.status === "Done") return "";
  const d = (Date.parse(t.due) - Date.parse(today)) / 86400000;
  return d < 0 ? "Overdue" : d === 0 ? "Due today" : d <= 2 ? "Due soon" : "";
}
export const initials = (s: string) =>
  s
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
