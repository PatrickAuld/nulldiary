import { Hono } from "hono";
import type { Db } from "@aipromptsecret/db";
import { extractRequest } from "../extract-request.js";
import { parseMessage } from "../parse-message.js";
import { persistIngestion } from "../persistence.js";

export function createIngestRoute(db: Db) {
  const route = new Hono();

  route.all("/s/*", async (c) => {
    const raw = await extractRequest(c);
    const parsed = parseMessage(raw);
    await persistIngestion(db, raw, parsed);
    return c.json({ status: parsed.status }, 200);
  });

  route.all("/s", async (c) => {
    const raw = await extractRequest(c);
    const parsed = parseMessage(raw);
    await persistIngestion(db, raw, parsed);
    return c.json({ status: parsed.status }, 200);
  });

  return route;
}
