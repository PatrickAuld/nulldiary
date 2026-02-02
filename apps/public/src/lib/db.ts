import { createDb, type Db } from "@aipromptsecret/db";

let db: Db | null = null;

export function getDb(): Db {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    db = createDb(url);
  }
  return db;
}
