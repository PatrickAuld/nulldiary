export interface RawRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string | null;
  contentType: string | null;
}

export type ParseSource = "header" | "body" | "query" | "path";

export type ParseResult =
  | { message: string; status: "success"; source: ParseSource }
  | { message: null; status: "failed"; source: null };
