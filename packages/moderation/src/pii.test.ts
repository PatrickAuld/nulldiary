import { describe, it, expect } from "vitest";
import { detectPii } from "./pii.js";

describe("detectPii", () => {
  it("returns [] for empty input", () => {
    expect(detectPii("")).toEqual([]);
  });

  it("detects a Luhn-valid credit card", () => {
    const text = "pay 4111-1111-1111-1111 thanks";
    const hits = detectPii(text);
    expect(hits).toEqual([
      {
        category: "credit_card",
        match: "4111-1111-1111-1111",
        start: text.indexOf("4111"),
        end: text.indexOf("4111") + "4111-1111-1111-1111".length,
      },
    ]);
  });

  it("detects an email with a + tag and multi-part TLD", () => {
    const text = "alice+work@example.co.uk";
    expect(detectPii(text)).toEqual([
      {
        category: "email",
        match: "alice+work@example.co.uk",
        start: 0,
        end: text.length,
      },
    ]);
  });

  it("detects a NANP-style phone number with country code and parens", () => {
    const text = "+1 (415) 555-1234";
    const hits = detectPii(text);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      category: "phone",
      match: text,
      start: 0,
      end: text.length,
    });
  });

  it("detects an IPv4 address in prose", () => {
    const text = "connect to 10.0.0.1 please";
    expect(detectPii(text)).toEqual([
      {
        category: "ipv4",
        match: "10.0.0.1",
        start: text.indexOf("10."),
        end: text.indexOf("10.") + "10.0.0.1".length,
      },
    ]);
  });

  it("returns mixed hits sorted by start offset", () => {
    const text = "ssn 123-45-6789 then ip 10.0.0.1 then mail bob@example.com";
    const hits = detectPii(text);
    expect(hits.map((h) => h.category)).toEqual(["ssn", "ipv4", "email"]);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i].start).toBeGreaterThan(hits[i - 1].start);
    }
  });

  it("does not light up on natural-language numbers without separators", () => {
    const text =
      "there are 8675309 stars in the sky and a 123456789 invoice number";
    expect(detectPii(text)).toEqual([]);
  });

  it("does not emit a phantom phone hit when a credit card is present", () => {
    const hits = detectPii("4111-1111-1111-1111");
    expect(hits).toHaveLength(1);
    expect(hits[0].category).toBe("credit_card");
  });

  it("rejects an IPv4 with an out-of-range octet", () => {
    expect(detectPii("999.0.0.1")).toEqual([]);
  });

  it("does not match a bare 10-digit number as a phone", () => {
    expect(detectPii("4155551234")).toEqual([]);
  });

  it("does not match strings without a TLD or @ as emails", () => {
    expect(detectPii("not-an-email")).toEqual([]);
    expect(detectPii("a@b")).toEqual([]);
  });

  it("matches a credit card with spaces as separators", () => {
    const text = "4111 1111 1111 1111";
    const hits = detectPii(text);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      category: "credit_card",
      match: text,
      start: 0,
      end: text.length,
    });
  });

  it("rejects credit-card-shaped strings that fail Luhn", () => {
    expect(detectPii("pay 4111-1111-1111-1112 thanks")).toEqual([]);
  });

  it("does not match a bare 9-digit number as an SSN", () => {
    expect(detectPii("123456789")).toEqual([]);
  });

  it("rejects SSNs in reserved/invalid blocks", () => {
    // SSA never issues area 000, 666, or 9XX; group 00; serial 0000.
    expect(detectPii("000-12-3456")).toEqual([]);
    expect(detectPii("666-12-3456")).toEqual([]);
    expect(detectPii("900-12-3456")).toEqual([]);
    expect(detectPii("999-12-3456")).toEqual([]);
    expect(detectPii("123-00-3456")).toEqual([]);
    expect(detectPii("123-45-0000")).toEqual([]);
  });

  it("detects a well-formed SSN", () => {
    const text = "my ssn is 123-45-6789 ok";
    expect(detectPii(text)).toEqual([
      {
        category: "ssn",
        match: "123-45-6789",
        start: text.indexOf("123"),
        end: text.indexOf("123") + "123-45-6789".length,
      },
    ]);
  });
});
