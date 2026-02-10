"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * In Next.js, only NEXT_PUBLIC_* env vars are available in the client bundle.
 * This returns null if Supabase is not configured.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
