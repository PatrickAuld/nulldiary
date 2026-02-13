import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function GET(): Promise<Response> {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const { data, error } = await db
    .from("ip_denylist")
    .select("network, reason, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return NextResponse.json({ networks: data ?? [] });
}

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    op?: unknown;
    ip?: unknown;
    network?: unknown;
    reason?: unknown;
  };

  const op = body.op;
  const rawNetwork =
    (typeof body.network === "string" ? body.network : null) ??
    (typeof body.ip === "string" ? body.ip : null);
  const reason = body.reason;

  if (op !== "add" && op !== "remove") {
    return NextResponse.json(
      { error: "op must be add or remove" },
      { status: 400 },
    );
  }

  if (!rawNetwork || typeof rawNetwork !== "string") {
    return NextResponse.json(
      { error: "network (or ip) is required" },
      { status: 400 },
    );
  }

  function normalizeNetwork(input: string): string {
    const trimmed = input.trim();
    if (trimmed.includes("/")) return trimmed;

    // Host address
    if (trimmed.includes(":")) return `${trimmed}/128`;
    return `${trimmed}/32`;
  }

  const network = normalizeNetwork(rawNetwork);

  const db = getDb();

  if (op === "add") {
    const { error } = await db.from("ip_denylist").upsert({
      network,
      reason: typeof reason === "string" ? reason : null,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  }

  const { error } = await db
    .from("ip_denylist")
    .delete()
    .eq("network", network);
  if (error) throw error;
  return NextResponse.json({ ok: true });
}
