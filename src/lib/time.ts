/** Instants are UTC in storage; calendar-only dates never shift timezone. */
export function localTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
export function dateInZone(now = new Date(), timezone = localTimezone()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function localTimestamp(value: string, timezone = localTimezone()) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
export function validTimezone(value: unknown) {
  if (typeof value !== "string" || value.length > 100)
    throw Error("Timezone tidak valid.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
  } catch {
    throw Error("Timezone tidak valid.");
  }
  return value;
}
