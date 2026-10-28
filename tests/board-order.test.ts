import test from "node:test";
import assert from "node:assert/strict";
import { placeBoardCard, sortBoardRows } from "../src/lib/board-order";

test("Kanban dates put ongoing/future first, past dates next and undated last", () => {
  const rows = [
    { id: "past", start: "2026-10-01", end: "2026-10-02" },
    { id: "future", start: "2026-11-01", end: "2026-11-02" },
    { id: "none", start: "", end: "" },
    { id: "ongoing", start: "2026-10-27", end: "2026-10-30" },
  ];
  assert.deepEqual(
    sortBoardRows(rows, "nearest", [], "2026-10-28").map((x) => x.id),
    ["ongoing", "future", "past", "none"],
  );
  assert.deepEqual(
    sortBoardRows(rows, "latest", [], "2026-10-28").map((x) => x.id),
    ["future", "ongoing", "past", "none"],
  );
  assert.equal(rows[0].id, "past", "sorting never mutates the snapshot");
});
test("manual ordering and insertion handle up, down, a new column and empty columns", () => {
  assert.deepEqual(placeBoardCard(["a", "b", "c"], "c", "a", false), [
    "c",
    "a",
    "b",
  ]);
  assert.deepEqual(placeBoardCard(["a", "b", "c"], "a", "c", true), [
    "b",
    "c",
    "a",
  ]);
  assert.deepEqual(placeBoardCard(["b", "c"], "a", "c", false), [
    "b",
    "a",
    "c",
  ]);
  assert.deepEqual(placeBoardCard([], "a", null, false), ["a"]);
  assert.deepEqual(
    sortBoardRows(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      "manual",
      ["c", "a"],
      "",
    ).map((x) => x.id),
    ["c", "a", "b"],
  );
});
