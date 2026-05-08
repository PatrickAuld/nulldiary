import type { PiiCategory } from "./pii.js";
import type { ToxicityCategory } from "./toxicity.js";

export const RATE_LIMIT_DEFAULT = 100;
export const RATE_LIMIT_WINDOW_MS_DEFAULT = 10_000;
export const RATE_LIMIT_BUCKET_MS_DEFAULT = 1_000;

/**
 * Which PII categories trigger auto-deny vs. just flag for human review.
 * Phone/email/IPv4 stay FLAG-only because false positives are common
 * (a moderator may want to redact rather than deny). SSN and Luhn-valid
 * credit cards are unambiguous enough to auto-deny.
 */
export const PII_AUTO_DENY: Record<PiiCategory, boolean> = {
  ssn: true,
  credit_card: true,
  phone: false,
  email: false,
  ipv4: false,
};

/**
 * Per-category toxicity score at-or-above which we auto-deny without human
 * review. Tuned conservatively — a missed deny is recoverable (human can deny
 * later); a wrong deny silently buries legitimate content.
 *
 * sexual_minors is the exception: any non-trivial signal warrants a deny.
 */
export const T_DENY: Record<ToxicityCategory, number> = {
  sexual_minors: 0.5,
  hate: 0.92,
  harassment: 0.92,
  violence: 0.95,
  self_harm: 0.95,
  sexual: 0.95,
  illicit: 0.95,
};

/**
 * Below T_DENY but at-or-above T_FLAG: surface to human moderators with a
 * risk_score and labels. Single threshold across categories — the labels
 * carry the per-category detail.
 */
export const T_FLAG = 0.6;
