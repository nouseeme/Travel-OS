import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" } },
});
if (!values.email || !values.name || !process.env.SUPABASE_SECRET_KEY)
  throw new Error(
    "Use npm run bootstrap -- --email YOUR_EMAIL --name YOUR_NAME after configuring .env.local.",
  );
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
const users = await admin.auth.admin.listUsers();
if (users.error) throw users.error;
const user = users.data.users.find((u) => u.email === values.email);
if (!user)
  throw new Error(
    "Create the first confirmed Auth user manually in Supabase first. This script does not generate/store passwords.",
  );
const active = await admin
  .from("memberships")
  .select("id")
  .eq("role", "admin")
  .eq("status", "active");
if (active.error) throw active.error;
if (active.data.length)
  throw new Error(
    "An active admin already exists; bootstrap cannot add more admins.",
  );
const { error } = await admin.from("memberships").insert({
  id: user.id,
  workspace_id:
    process.env.WORKSPACE_ID || "10000000-0000-4000-8000-000000000001",
  name: values.name,
  email: values.email,
  role: "admin",
  status: "active",
  privileges: { sales: "edit", trips: "edit", finance: "edit", docs: "edit" },
});
if (error) throw error;
console.log("First admin activated. Sign in through /login.");
