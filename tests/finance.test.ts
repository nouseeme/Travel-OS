import test from "node:test";
import assert from "node:assert/strict";
import {
  money,
  date,
  totals,
  csvCell,
  dueLabel,
  todayIn,
} from "../src/lib/domain";
import type { Transaction } from "../src/lib/model";
import {
  decimalString,
  minorUnits,
  formatIDR,
  formatMoneyInput,
  parseMoneyInput,
} from "../src/lib/money";
test("IDR input groups live digits and retains hundredths without floating point", () => {
  assert.equal(formatMoneyInput("1250000,50"), "1.250.000,50");
  assert.equal(parseMoneyInput("1.250.000,50"), "1250000.5");
  assert.equal(formatIDR("9007199254740993.51"), "Rp 9.007.199.254.740.993,51");
  assert.equal(decimalString(minorUnits("10.02") - minorUnits("9.99")), "0.03");
  assert.equal(decimalString(minorUnits("0.01") - minorUnits("1")), "-0.99");
  for (const invalid of ["1,", "1,234", "1.25", "-1", "1e3"])
    assert.throws(() => parseMoneyInput(invalid));
});
test("decimal IDR input preserves precision and rejects ambiguous or excessive values", () => {
  assert.equal(money("9007199254740993"), "9007199254740993");
  assert.equal(money("00015"), "15");
  for (const v of [
    "1,5",
    "1.555",
    "1e3",
    "-1",
    "0",
    "Infinity",
    "NaN",
    "9223372036854775808",
    1000,
    null,
  ])
    assert.throws(() => money(v));
  assert.equal(money("0", false), "0");
  assert.equal(money("1.50"), "1.5");
  assert.equal(money("0.01"), "0.01");
  assert.equal(money("9223372036854775807.99"), "9223372036854775807.99");
});
test("cash arithmetic is exact beyond JavaScript safe integers", () => {
  const row = (amount: string, direction: "in" | "out", status = "posted") =>
    ({ amount, direction, status }) as Transaction;
  assert.deepEqual(
    totals([
      row("9007199254740993", "in"),
      row("9007199254740992", "out"),
      row("10000000", "in", "void"),
    ]),
    { moneyIn: "9007199254740993", moneyOut: "9007199254740992", net: "1" },
  );
});
test("dates do not normalize invalid calendar dates", () => {
  assert.throws(() => date("2026-02-29"));
  assert.equal(date("2028-02-29"), "2028-02-29");
  assert.equal(date("", false), "");
  assert.throws(() => date("14/10/2026"));
});
test("deadline warnings use workspace business date and exclude Done", () => {
  const due = (d: string, status = "Assigned") =>
    dueLabel({ due: d, status: status as "Assigned" }, "2026-10-14");
  assert.equal(due("2026-10-13"), "Overdue");
  assert.equal(due("2026-10-14"), "Due today");
  assert.equal(due("2026-10-16"), "Due soon");
  assert.equal(due("2026-10-17"), "");
  assert.equal(due("2026-10-13", "Done"), "");
  assert.equal(
    todayIn("Asia/Jakarta", new Date("2026-10-13T18:00:00Z")),
    "2026-10-14",
  );
});
test("CSV protects formula cells and quotes Unicode, commas, and newlines", () => {
  assert.equal(csvCell("  =1+1"), '"\'  =1+1"');
  assert.equal(csvCell("@SUM(A1)"), '"\'@SUM(A1)"');
  assert.equal(csvCell('Klien "A",\nJakarta'), '"Klien ""A"",\nJakarta"');
});
