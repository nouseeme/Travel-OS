import "server-only";
import { configured, supabase } from "@/lib/supabase/server";

export type HelpAccess = "allowed" | "locked" | "unavailable";
export async function getHelpAccess(): Promise<HelpAccess> {
  if (!configured()) return "unavailable";
  try {
    const client = await supabase();
    const { data, error } = await client.rpc("help_access");
    if (!error && typeof data?.allowed === "boolean")
      return data.allowed ? "allowed" : "locked";
  } catch {
    /* Keep guide content private if its access check fails. */
  }
  return "unavailable";
}
