export type AutoActionFilter =
  | "denied"
  | "flagged"
  | "cleared"
  | "any-auto"
  | "human-only";

export interface MessageListFilters {
  status?: "pending" | "approved" | "denied";
  search?: string;
  after?: Date;
  before?: Date;
  limit?: number;
  offset?: number;
  autoAction?: AutoActionFilter;
  minRiskScore?: number;
}

export interface ModerationInput {
  messageId: string;
  actor: string;
  reason?: string;
  editedContent?: string;
  // When true and the target is system-denied, allow approving it.
  // Human-actored denials cannot be overridden via this flag.
  override?: boolean;
}

export type ModerationResult = { ok: true } | { ok: false; error: string };
