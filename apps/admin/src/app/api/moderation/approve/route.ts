import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { approveMessage } from "@/data/actions";
import { createClient } from "@/lib/supabase/server";

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

  const body = await req.json();
  const { messageId, reason, editedContent } = body;

  if (!messageId || typeof messageId !== "string") {
    return NextResponse.json(
      { error: "messageId is required" },
      { status: 400 },
    );
  }

  if (editedContent !== undefined && typeof editedContent !== "string") {
    return NextResponse.json(
      { error: "editedContent must be a string" },
      { status: 400 },
    );
  }

  const actor = user.email || user.id;

  try {
    const result = await approveMessage(getDb(), {
      messageId,
      actor,
      reason,
      editedContent: editedContent?.trim() || undefined,
    });

    if (!result.ok) {
      const status = result.error === "Message not found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Ensure the client always gets JSON, otherwise the UI can appear to hang.
    const e = err as { code?: string; message?: string };

    if (e?.code === "PGRST204") {
      return NextResponse.json(
        {
          error:
            "Database schema is missing edited_content (run migrations for this environment)",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: e?.message ?? "Failed to approve message" },
      { status: 500 },
    );
  }
}
