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
test("whole-rupiah input preserves precision and rejects ambiguous values", () => {
  assert.equal(money("9007199254740993"), "9007199254740993");
  assert.equal(money("00015"), "15");
  for (const v of [
    "1,5",
    "1.5",
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
