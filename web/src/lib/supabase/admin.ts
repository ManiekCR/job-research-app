import "server-only";
import { createClient } from "@supabase/supabase-js";

// Client "admin" : contourne RLS avec la clé service_role. Réservé aux
// tâches sans session utilisateur (le cron), qui ne peuvent pas s'authentifier
// via cookie comme les Server Actions/Components.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}