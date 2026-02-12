import type { Db } from "@nulldiary/db";
import { extractRequest } from "./extract-request.js";
import { parseMessage } from "./parse-message.js";
import { persistIngestion } from "./persistence.js";

export async function handleIngestion(
  request: Request,
  db: Db,
): Promise<Response> {
  const raw = await extractRequest(request);
  const parsed = parseMessage(raw);
  await persistIngestion(db, raw, parsed);
  return Response.json(
    { status: parsed.status },
    {
      status: 200,
      headers: {
        // Never cache ingestion responses.
        "Cache-Control": "no-store",
      },
    },
  );
}
