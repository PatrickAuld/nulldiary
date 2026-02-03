export const runtime = "edge";

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listMessages } from "@/data/queries";

const VALID_STATUSES = new Set(["pending", "approved", "denied"]);

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";
  const search = url.searchParams.get("search") ?? undefined;
  const afterParam = url.searchParams.get("after");
  const beforeParam = url.searchParams.get("before");
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json(
      { error: `Invalid status: ${status}. Must be pending, approved, or denied.` },
      { status: 400 },
    );
  }

  const after = afterParam ? new Date(afterParam) : undefined;
  const before = beforeParam ? new Date(beforeParam) : undefined;

  const result = await listMessages(getDb(), {
    status: status as "pending" | "approved" | "denied",
    search,
    after,
    before,
    limit,
    offset,
  });

  return NextResponse.json(result);
}
