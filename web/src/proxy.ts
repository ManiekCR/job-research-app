import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // "api/cron" est exclu : ces routes n'ont pas de session utilisateur
    // (déclenchées par Vercel Cron) et gèrent leur propre authentification
    // via CRON_SECRET.
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};