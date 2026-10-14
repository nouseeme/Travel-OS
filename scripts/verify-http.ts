import assert from "node:assert/strict";

// Run against `next start`, not `next dev`: development intentionally allows eval.
const base = process.argv[2] || "http://127.0.0.1:3001";
const origin = new URL(base).origin;
async function documentPolicy(path: string) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("permissions-policy") || "", /camera=\(\)/);
  const policy = response.headers.get("content-security-policy") || "";
  assert.doesNotMatch(policy, /unsafe-eval|script-src[^;]*unsafe-inline/);
  const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nonce, path + " must have a script nonce");
  const html = await response.text();
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(scripts.length > 0);
  assert.ok(
    scripts.every((tag) => tag.includes(`nonce="${nonce}"`)),
    path + " framework scripts must have the matching nonce",
  );
  return nonce;
}
assert.notEqual(await documentPolicy("/login"), await documentPolicy("/home"));
await documentPolicy("/shared-trip/" + "0".repeat(64));
console.log(
  "PASS production HTML has unique matching script nonces and security/cache headers",
);
const logo = await fetch(base + "/brand/egimu-logo.jpg");
assert.equal(logo.status, 200);
assert.match(logo.headers.get("cache-control") || "", /public.*max-age=86400/);
assert.equal(logo.headers.has("set-cookie"), false);
console.log("PASS public logo is cacheable without session cookies");
for (const [path, status] of [
  ["/api/workspace?view=home", 401],
  ["/api/insights?mode=invalid", 400],
] as const) {
  const response = await fetch(base + path);
  assert.equal(response.status, status, path);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
}
for (const [requestOrigin, content, status] of [
  ["https://evil.example.test", '{"action":"logout"}', 403],
  [origin, "{", 400],
] as const) {
  const response = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { origin: requestOrigin, "Content-Type": "application/json" },
    body: content,
  });
  assert.equal(response.status, status);
}
const share = await fetch(base + "/share/" + "0".repeat(64));
assert.equal(share.status, 404);
assert.match(
  share.headers.get("content-security-policy") || "",
  /default-src 'none'/,
);
assert.doesNotMatch(await share.text(), /<script\b/);
console.log(
  "PASS unauthenticated reads, invalid input, CSRF and script-free shared documents",
);
