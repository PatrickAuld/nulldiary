import { describe, it, expect } from "vitest";
import { decide } from "./decide.js";
import type { PiiHit } from "./pii.js";

describe("decide", () => {
  it("returns deny with reason='tox:<category>' when score >= T_DENY", () => {
    const result = decide({ hate: 0.95 }, []);
    expect(result).toEqual({ action: "deny", reason: "tox:hate" });
  });

  it("returns deny with reason='pii:<category>' when an auto-deny PII hit is present (no toxicity deny)", () => {
    const hits: PiiHit[] = [
      { category: "credit_card", match: "x", start: 0, end: 1 },
    ];
    expect(decide({}, hits)).toEqual({
      action: "deny",
      reason: "pii:credit_card",
    });
  });

  it("toxicity deny preempts PII deny (toxicity is checked first for deterministic precedence)", () => {
    const hits: PiiHit[] = [{ category: "ssn", match: "x", start: 0, end: 1 }];
    expect(decide({ violence: 0.99 }, hits)).toEqual({
      action: "deny",
      reason: "tox:violence",
    });
  });

  it("returns flag when toxicity is between T_FLAG and T_DENY", () => {
    const result = decide({ hate: 0.7 }, []);
    expect(result.action).toBe("flag");
    if (result.action !== "flag") throw new Error();
    expect(result.riskScore).toBeCloseTo(0.7);
    expect(result.labels).toContainEqual({ category: "hate", score: 0.7 });
  });

  it("returns flag when only a flag-only PII category is present", () => {
    const hits: PiiHit[] = [
      { category: "email", match: "a@b.co", start: 0, end: 6 },
    ];
    const result = decide({}, hits);
    expect(result.action).toBe("flag");
    if (result.action !== "flag") throw new Error();
    expect(result.labels).toContainEqual({ category: "pii:email", score: 1 });
  });

  it("flag includes pii:<category> labels when both toxicity and PII are present below deny", () => {
    const hits: PiiHit[] = [
      { category: "ipv4", match: "1.2.3.4", start: 0, end: 7 },
    ];
    const result = decide({ harassment: 0.65 }, hits);
    if (result.action !== "flag") throw new Error("expected flag");
    expect(result.labels).toEqual(
      expect.arrayContaining([
        { category: "harassment", score: 0.65 },
        { category: "pii:ipv4", score: 1 },
      ]),
    );
    expect(result.riskScore).toBeCloseTo(0.65);
  });

  it("returns none when nothing crosses any threshold and no PII", () => {
    expect(decide({ hate: 0.1, violence: 0.2 }, [])).toEqual({
      action: "none",
    });
  });
});
