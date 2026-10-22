import { handleIngestion } from "@nulldiary/ingestion";
import { getDb } from "@/lib/db";
import { notifyTelegram } from "@/lib/telegram";

async function handler(request: Request) {
  const db = getDb();
  return handleIngestion(request, db, { onSecretShared: notifyTelegram });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
