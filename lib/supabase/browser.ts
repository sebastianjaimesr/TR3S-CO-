"use client";
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv, isSupabaseConfigured } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function supabaseBrowser() {
  if (!isSupabaseConfigured()) return null;
  client ??= createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return client;
}
