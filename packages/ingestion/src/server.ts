import { serve } from "@hono/node-server";
import { createDb } from "@aipromptsecret/db";
import { createApp } from "./app.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const port = Number(process.env.PORT) || 3001;
const db = createDb(databaseUrl);
const app = createApp(db);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Ingestion server listening on port ${port}`);
});
