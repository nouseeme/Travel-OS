import test from "node:test";
import assert from "node:assert/strict";
import { body, failure } from "../src/lib/http";
import { dbError } from "../src/lib/database-error";

test("database internals are redacted while safe application errors survive", async () => {
  for (const [code, status] of [
    ["23505", 409],
    ["42501", 403],
    ["XX000", 500],
    ["57014", 503],
    ["PT429", 429],
  ] as const) {
    try {
      dbError({ code, message: "private.secret_table sensitive value" });
    } catch (error) {
      const response = failure(error);
      assert.equal(response.status, status);
      assert.doesNotMatch(
        await response.text(),
        /secret_table|sensitive value/,
      );
    }
  }
  assert.throws(
    () => dbError({ code: "P0001", message: "Pilih minimal satu tab" }),
    /Pilih minimal satu tab/,
  );
});

test("unexpected server failures are 500 without internal details", async () => {
  const response = failure(new Error("secret database relation"));
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.doesNotMatch(await response.text(), /secret database relation/);
});

test("malformed JSON is a safe client error", async () => {
  try {
    await body(
      new Request("https://example.test/api", { method: "POST", body: "{" }),
    );
    assert.fail("Expected invalid JSON to fail");
  } catch (error) {
    assert.equal(failure(error).status, 400);
  }
});
