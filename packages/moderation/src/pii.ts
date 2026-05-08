export type PiiCategory = "ssn" | "credit_card" | "phone" | "email" | "ipv4";

export type PiiHit = {
  category: PiiCategory;
  match: string;
  start: number;
  end: number;
};

// Require dashes — bare 9-digit numbers collide too often with IDs/timestamps.
const SSN_RE = /\b(\d{3})-(\d{2})-(\d{4})\b/g;

// 13-19 digits with optional space/dash separators — covers the full PAN
// length range (Visa 13/16/19, Amex 15, Discover 16/19, Maestro 13-19).
// Anchor the trailing digit so we don't pull in a stray separator after the
// final group. Luhn weeds out the rest.
const CC_RE = /\b(?:\d[ -]?){12,18}\d\b/g;

// RFC-5321-ish — precision over recall is fine here; we'd rather miss a
// weird-but-valid email than light up free-form prose. TLD ≥ 2 letters.
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// NANP-style phone. We require an explicit separator (space, dot, dash,
// or parens/+) somewhere in the match — bare 10-digit runs are too often
// timestamps or row IDs to auto-flag. The leading anchor uses a lookbehind
// so an optional "+" can be included in the match.
const PHONE_RE =
  /(?<![A-Za-z0-9])(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b/g;

// Each octet 0-255 — the alternation rejects 256+ outright so we don't
// flag random dot-separated numbers as IPs.
const IPV4_OCTET = "(?:25[0-5]|2[0-4]\\d|[01]?\\d?\\d)";
const IPV4_RE = new RegExp(`\\b(?:${IPV4_OCTET}\\.){3}${IPV4_OCTET}\\b`, "g");

function luhnValid(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// SSA never issues area 000, 666, or 9XX; group 00; serial 0000.
// Dash + reserved-block check is precise enough; full SSA-list validation
// would add bulk without meaningful precision lift.
function isValidSsn(area: string, group: string, serial: string): boolean {
  if (area === "000" || area === "666") return false;
  if (area[0] === "9") return false;
  if (group === "00") return false;
  if (serial === "0000") return false;
  return true;
}

export function detectPii(text: string): PiiHit[] {
  const hits: PiiHit[] = [];

  for (const m of text.matchAll(SSN_RE)) {
    if (!isValidSsn(m[1], m[2], m[3])) continue;
    hits.push({
      category: "ssn",
      match: m[0],
      start: m.index!,
      end: m.index! + m[0].length,
    });
  }

  for (const m of text.matchAll(CC_RE)) {
    const digits = m[0].replace(/[ -]/g, "");
    if (digits.length < 13 || digits.length > 19) continue;
    if (!luhnValid(digits)) continue;
    hits.push({
      category: "credit_card",
      match: m[0],
      start: m.index!,
      end: m.index! + m[0].length,
    });
  }

  for (const m of text.matchAll(EMAIL_RE)) {
    hits.push({
      category: "email",
      match: m[0],
      start: m.index!,
      end: m.index! + m[0].length,
    });
  }

  for (const m of text.matchAll(PHONE_RE)) {
    // Require an explicit separator/paren/+ in the match — bare 10-digit
    // runs are too often timestamps or row IDs to flag as phone numbers.
    if (!/[ .()+-]/.test(m[0])) continue;
    const start = m.index!;
    const end = start + m[0].length;
    // Credit cards are unambiguous (Luhn-validated) and the more sensitive
    // category — defer to the credit_card hit if their spans overlap.
    if (
      hits.some((h) => h.category === "credit_card" && overlaps(h, start, end))
    ) {
      continue;
    }
    hits.push({ category: "phone", match: m[0], start, end });
  }

  for (const m of text.matchAll(IPV4_RE)) {
    hits.push({
      category: "ipv4",
      match: m[0],
      start: m.index!,
      end: m.index! + m[0].length,
    });
  }

  hits.sort((a, b) => a.start - b.start);
  return hits;
}

function overlaps(
  a: { start: number; end: number },
  start: number,
  end: number,
): boolean {
  return a.start < end && start < a.end;
}
