import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

export function createBrowserSupabaseClient() {
  const env = getSupabaseEnv();

  if (!env) {
    return null;
  }

  return createBrowserClient(env.url, env.anonKey);
}
