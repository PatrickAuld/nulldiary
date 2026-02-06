import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request): Promise<Response> {
  const supabase = createServerSupabaseClient();
  const requestUrl = new URL(request.url);
  const next = requestUrl.searchParams.get("next") ?? "/messages";

  if (!supabase) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const code = requestUrl.searchParams.get("code");

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
