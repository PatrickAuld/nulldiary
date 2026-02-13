export interface Message {
  id: string;
  content: string;
  edited_content: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  approved_at: string | null;
  denied_at: string | null;
  moderation_status: "pending" | "approved" | "denied";
  moderated_by: string | null;
  tags: string[] | null;
  short_id: string | null;
}

export interface IngestionEvent {
  id: string;
  received_at: string;
  method: string;
  path: string;
  query: Record<string, unknown>;
  headers: Record<string, string>;
  body: string | null;
  source_ip: string | null;
  user_agent: string | null;
  raw_payload: Record<string, unknown> | null;
  parsed_message: string | null;
  parse_status: "success" | "partial" | "failed";
  message_id: string | null;
}

export interface ModerationAction {
  id: string;
  message_id: string;
  action: "approved" | "denied";
  actor: string;
  reason: string | null;
  created_at: string;
}

export interface FeaturedSet {
  id: string;
  slug: string;
  title: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeaturedSetMessage {
  id: string;
  set_id: string;
  message_id: string;
  position: number;
  created_at: string;
}

export interface AdminUser {
  id: string;
  user_id: string;
  email: string | null;
  created_at: string;
}
