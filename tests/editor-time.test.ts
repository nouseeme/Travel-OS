import test from "node:test";
import assert from "node:assert/strict";
import { dateInZone, localTimestamp, validTimezone } from "../src/lib/time";
import { parseFilters } from "../src/lib/filters";
test("local calendar date handles midnight and daylight-saving changes", () => {
  const instant = new Date("2026-10-14T00:30:00Z");
  assert.equal(dateInZone(instant, "America/Los_Angeles"), "2026-10-13");
  assert.equal(dateInZone(instant, "Europe/Istanbul"), "2026-10-14");
  assert.match(
    localTimestamp(instant.toISOString(), "Europe/Istanbul"),
    /03[.:]30/,
  );
  assert.match(
    localTimestamp("2026-03-08T06:30:00Z", "America/New_York"),
    /01[.:]30/,
  );
  assert.match(
    localTimestamp("2026-03-08T07:30:00Z", "America/New_York"),
    /03[.:]30/,
  );
  assert.equal(
    parseFilters({ from: "2026-10-14", timezone: "America/Los_Angeles" }).from,
    "2026-10-14",
  );
  assert.throws(() => validTimezone("Invalid/Timezone"));
  assert.throws(() => parseFilters({ timezone: "Invalid/Timezone" }));
});
