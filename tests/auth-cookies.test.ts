import test from "node:test";
import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";
import { authCookieOptions } from "../src/lib/supabase/cookie-options";

test("server-only Auth writes HttpOnly cookies and uses Secure for HTTPS", async () => {
  for (const origin of [
    "http://127.0.0.1:3000",
    "https://travel.example.test",
  ]) {
    const written: {
      name: string;
      value: string;
      options: {
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: unknown;
        path?: string;
      };
    }[] = [];
    const client = createServerClient(
      "https://project.supabase.co",
      "publishable-test-key",
      {
        cookieOptions: authCookieOptions(origin),
        cookies: {
          getAll: () => [],
          setAll: (values) => {
            written.push(...values);
          },
        },
        global: {
          fetch: async () =>
            Response.json({
              access_token: "test-access-token",
              refresh_token: "test-refresh-token",
              token_type: "bearer",
              expires_in: 3600,
              user: { id: "test-user", email: "test@example.test" },
            }),
        },
      },
    );
    const result = await client.auth.signInWithPassword({
      email: "test@example.test",
      password: "synthetic-password",
    });
    assert.equal(result.error, null);
    assert.ok(written.length > 0);
    for (const cookie of written) {
      assert.equal(cookie.options.httpOnly, true);
      assert.equal(cookie.options.secure, origin.startsWith("https:"));
      assert.equal(cookie.options.sameSite, "lax");
      assert.equal(cookie.options.path, "/");
    }
  }
});
