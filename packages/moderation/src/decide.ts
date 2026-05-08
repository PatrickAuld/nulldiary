import type { PiiHit } from "./pii.js";
import type { ToxicityCategory, ToxicityScores } from "./toxicity.js";
import { PII_AUTO_DENY, T_DENY, T_FLAG } from "./thresholds.js";

export type Decision =
  | { action: "deny"; reason: string }
  | {
      action: "flag";
      riskScore: number;
      labels: { category: string; score: number }[];
    }
  | { action: "none" };

export function decide(scores: ToxicityScores, piiHits: PiiHit[]): Decision {
  // Toxicity deny takes precedence over PII deny: it's the stronger signal
  // (model-scored intent) and choosing one keeps reasons stable for tests
  // and human moderators.
  for (const [cat, threshold] of Object.entries(T_DENY) as [
    ToxicityCategory,
    number,
  ][]) {
    const score = scores[cat];
    if (score !== undefined && score >= threshold) {
      return { action: "deny", reason: `tox:${cat}` };
    }
  }

  for (const hit of piiHits) {
    if (PII_AUTO_DENY[hit.category]) {
      return { action: "deny", reason: `pii:${hit.category}` };
    }
  }

  const labels: { category: string; score: number }[] = [];
  let maxToxicity = 0;
  for (const [cat, score] of Object.entries(scores) as [
    ToxicityCategory,
    number,
  ][]) {
    if (score >= T_FLAG) {
      labels.push({ category: cat, score });
      if (score > maxToxicity) maxToxicity = score;
    }
  }

  for (const hit of piiHits) {
    labels.push({ category: `pii:${hit.category}`, score: 1 });
  }

  if (labels.length === 0) return { action: "none" };
  return { action: "flag", riskScore: maxToxicity, labels };
}
