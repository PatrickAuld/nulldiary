import { createClient } from "@supabase/supabase-js";

export function createDb(supabaseUrl: string, supabaseKey: string) {
  return createClient(supabaseUrl, supabaseKey);
}

export type Db = ReturnType<typeof createDb>;
