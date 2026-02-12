export interface MessageListFilters {
  status?: "pending" | "approved" | "denied";
  search?: string;
  after?: Date;
  before?: Date;
  limit?: number;
  offset?: number;
}

export interface ModerationInput {
  messageId: string;
  actor: string;
  reason?: string;
  editedContent?: string;
}

export type ModerationResult = { ok: true } | { ok: false; error: string };
