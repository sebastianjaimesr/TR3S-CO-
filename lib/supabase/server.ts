import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv, isSupabaseConfigured } from "@/lib/env";

/** Request-scoped client acting as the signed-in user (RLS applies). */
export async function supabaseServer() {
  if (!isSupabaseConfigured()) return null;
  const store = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a Server Component: cookies are read-only there; middleware refreshes them
        }
      },
    },
  });
}

/** Anonymous client for public catalog reads (cacheable, no cookies). */
export function supabasePublic() {
  if (!isSupabaseConfigured()) return null;
  return createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Service-role client. Bypasses RLS: use ONLY in trusted server code
 * (payment webhooks). Never expose to the browser.
 */
export function supabaseService() {
  const key = serverEnv().supabaseServiceRoleKey;
  if (!isSupabaseConfigured() || !key) return null;
  return createClient(publicEnv.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
