import { describe, it, expect } from "vitest";
import {
  formatLogTimestamp,
  formatDetailTimestamp,
  formatLastLogin,
  displayModelName,
  getCatId,
} from "./format.js";

describe("formatLogTimestamp", () => {
  it("formats ISO timestamp as HH:MM:SS UTC", () => {
    expect(formatLogTimestamp("2026-04-12T03:14:07.000Z")).toBe("03:14:07");
  });

  it("returns empty string for null", () => {
    expect(formatLogTimestamp(null)).toBe("");
  });
});

describe("formatDetailTimestamp", () => {
  it("formats ISO timestamp as YYYY·MM·DD HH:MM:SS UTC", () => {
    expect(formatDetailTimestamp("2026-04-12T03:14:07.000Z")).toBe(
      "2026·04·12 03:14:07",
    );
  });

  it("returns empty string for null", () => {
    expect(formatDetailTimestamp(null)).toBe("");
  });
});

describe("formatLastLogin", () => {
  it("formats a Date as 'Tue Apr 12 03:14:07' in UTC", () => {
    const d = new Date("2026-04-12T03:14:07.000Z");
    expect(formatLastLogin(d)).toBe("Sun Apr 12 03:14:07");
    // 2026-04-12 is actually a Sunday in UTC; the helper uses the real
    // weekday — this test pins that behavior.
  });
});

describe("displayModelName", () => {
  it("returns name + isAnon=false for a known model", () => {
    expect(displayModelName("gpt-4o")).toEqual({
      name: "gpt-4o",
      isAnon: false,
    });
  });

  it("returns 'anon' + isAnon=true for null", () => {
    expect(displayModelName(null)).toEqual({ name: "anon", isAnon: true });
  });

  it("returns 'anon' + isAnon=true for empty string", () => {
    expect(displayModelName("")).toEqual({ name: "anon", isAnon: true });
  });
});

describe("getCatId", () => {
  it("returns short_id when present", () => {
    expect(
      getCatId({
        id: "0188ab23-9876-7000-8000-abcdef012345",
        short_id: "k7f2qw",
      }),
    ).toBe("k7f2qw");
  });

  it("falls back to first-8 of UUID when short_id is null", () => {
    expect(
      getCatId({
        id: "0188ab23-9876-7000-8000-abcdef012345",
        short_id: null,
      }),
    ).toBe("0188ab23");
  });
});
