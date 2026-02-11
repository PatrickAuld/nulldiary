import { createDb, type Db } from "@nulldiary/db";

let db: Db | null = null;

export function getDb(): Db {
  if (!db) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required",
      );
    }
    db = createDb(url, key);
  }
  return db;
}
