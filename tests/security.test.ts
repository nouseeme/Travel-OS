import test from "node:test";
import assert from "node:assert/strict";
import { originCheck, body } from "../src/lib/http";
import { parseFilters } from "../src/lib/filters";
test("mutations require the configured same origin", () => {
  const old = process.env.APP_URL;
  process.env.APP_URL = "https://travel.example.test";
  try {
    assert.doesNotThrow(() =>
      originCheck(
        new Request("https://travel.example.test/api/workspace", {
          headers: { origin: "https://travel.example.test" },
        }),
      ),
    );
    assert.throws(() =>
      originCheck(new Request("https://travel.example.test/api/workspace")),
    );
    assert.throws(() =>
      originCheck(
        new Request("https://travel.example.test/api/workspace", {
          headers: { origin: "https://evil.example.test" },
        }),
      ),
    );
  } finally {
    if (old === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = old;
  }
});
test("request bodies are capped even without Content-Length", async () => {
  await assert.rejects(
    body(
      new Request("https://travel.example.test/api/workspace", {
        method: "POST",
        body: "x".repeat(512001),
      }),
    ),
  );
  assert.deepEqual(
    await body(
      new Request("https://travel.example.test/api/workspace", {
        method: "POST",
        body: '{"action":"stage"}',
      }),
    ),
    { action: "stage" },
  );
});
test("filters reject invalid dates, inverted periods and unbounded pages", () => {
  assert.throws(() => parseFilters({ from: "2026-02-29" }));
  assert.throws(() => parseFilters({ from: "2026-10-20", to: "2026-10-01" }));
  assert.throws(() => parseFilters({ page: "-1" }));
  assert.throws(() => parseFilters({ page: "10001" }));
  assert.throws(() => parseFilters({ status: "draft" }));
  assert.deepEqual(
    parseFilters({ status: "posted", unexpected: "drop table" }),
    { status: "posted" },
  );
});
