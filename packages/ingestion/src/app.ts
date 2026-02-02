import { Hono } from "hono";
import type { Db } from "@aipromptsecret/db";
import { createIngestRoute } from "./routes/ingest.js";

export function createApp(db: Db) {
  const app = new Hono();
  app.route("/", createIngestRoute(db));
  return app;
}
