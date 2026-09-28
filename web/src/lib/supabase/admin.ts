import "server-only";
import { createClient } from "@supabase/supabase-js";

// "Admin" client: bypasses RLS with the service_role key. Reserved for
// tasks without a user session (the cron), which can't authenticate via
// cookie the way Server Actions/Components do.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}