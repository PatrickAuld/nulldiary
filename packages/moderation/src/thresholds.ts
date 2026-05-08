import type { PiiCategory } from "./pii.js";

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
