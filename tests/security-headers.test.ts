import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
import { contentSecurityPolicy } from "../src/lib/security-headers";

test("document policy has a unique nonce and forwards it for Next rendering", async () => {
  const old = process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    const first = await proxy(new NextRequest("http://localhost/home"));
    const second = await proxy(new NextRequest("http://localhost/home"));
    const policy = first.headers.get("content-security-policy")!;
    assert.match(policy, /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    assert.notEqual(policy, second.headers.get("content-security-policy"));
    assert.equal(
      first.headers.get("x-middleware-request-content-security-policy"),
      policy,
    );
    assert.equal(first.headers.get("cache-control"), "private, no-store");
    assert.doesNotMatch(
      contentSecurityPolicy("test", false),
      /unsafe-eval|script-src[^;]*unsafe-inline/,
    );
    assert.match(policy, /object-src 'none'/);
    assert.match(policy, /frame-ancestors 'none'/);
    const share = await proxy(
      new NextRequest("http://localhost/share/invalid"),
    );
    assert.equal(
      share.headers.has("content-security-policy"),
      false,
      "static share handler owns its script-free policy",
    );
  } finally {
    if (old === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = old;
  }
});
