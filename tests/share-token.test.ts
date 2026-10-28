import test from "node:test";
import assert from "node:assert/strict";
import { shareSlug, shareTokenPattern } from "../src/lib/share-token";

test("share titles become bounded URL slugs without changing the secret suffix", () => {
  assert.equal(
    shareSlug("İstanbul & Cappadocia 2026", "trip"),
    "istanbul-cappadocia",
  );
  assert.equal(shareSlug("日本語", "doc"), "doc");
  assert.equal(shareSlug("  Trip / One!  ", "trip"), "trip-one");
  assert.ok(
    shareTokenPattern.test(
      `${shareSlug("Bandung 2026", "trip")}-Abc_123456789012345678`,
    ),
  );
});

test("public handlers accept legacy tokens and reject truncated or unsafe capabilities", () => {
  assert.ok(shareTokenPattern.test("a".repeat(64)));
  assert.ok(shareTokenPattern.test("trip-1234567890123456789012"));
  for (const invalid of [
    "trip-1234",
    "../trip-1234567890123456789012",
    "a".repeat(63),
    "trip-1234567890123456789012?x=1",
  ])
    assert.equal(shareTokenPattern.test(invalid), false);
});
