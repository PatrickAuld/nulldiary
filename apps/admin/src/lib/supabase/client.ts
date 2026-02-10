"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Client-side Supabase helper.
 *
 * Note: In Next.js, only NEXT_PUBLIC_* env vars are available in the browser bundle.
 * This helper returns null when Supabase is not configured.
 */
export function createClient() {
  // Intentionally support both server-only and NEXT_PUBLIC naming.
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    "";

  if (!url || !key) return null;

  return createBrowserClient(url, key);
}
