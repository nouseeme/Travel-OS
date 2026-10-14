// Decimal strings at the boundary, integer hundredths for exact arithmetic.
export const MAX_IDR = 922337203685477580799n;
export function minorUnits(value: string): bigint {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Nominal tidak valid.");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}
export function decimalString(value: bigint): string {
  const n = value < 0n ? -value : value;
  const fraction = (n % 100n).toString().padStart(2, "0").replace(/0+$/, "");
  return `${value < 0n ? "-" : ""}${n / 100n}${fraction ? "." + fraction : ""}`;
}
export function formatIDR(value: string): string {
  const n = minorUnits(value || "0");
  const absolute = n < 0n ? -n : n;
  return `${n < 0n ? "−" : ""}Rp ${(absolute / 100n).toLocaleString("id-ID")}${absolute % 100n ? "," + (absolute % 100n).toString().padStart(2, "0") : ""}`;
}
export function formatMoneyInput(value: string): string {
  if (!value) return "";
  const [whole, fraction] = value.split(",");
  const digits = whole.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return (
    digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".") +
    (fraction === undefined
      ? ""
      : "," + fraction.replace(/\D/g, "").slice(0, 2))
  );
}
export function parseMoneyInput(value: string): string {
  // The displayed input uses Indonesian grouping and decimal separators.
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(value))
    throw new Error("Gunakan nominal seperti 1.250.000,50.");
  return decimalString(minorUnits(value.replaceAll(".", "").replace(",", ".")));
}
