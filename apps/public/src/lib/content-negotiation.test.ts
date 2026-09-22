import { describe, expect, it } from "vitest";
import {
  addVaryAccept,
  negotiatePageRepresentation,
} from "./content-negotiation.js";

describe("negotiatePageRepresentation", () => {
  it("defaults to HTML when Accept is absent", () => {
    expect(negotiatePageRepresentation(null)).toBe("html");
    expect(negotiatePageRepresentation("")).toBe("html");
  });

  it("selects Markdown when explicitly requested", () => {
    expect(negotiatePageRepresentation("text/markdown")).toBe("markdown");
    expect(negotiatePageRepresentation("text/markdown; charset=utf-8")).toBe(
      "markdown",
    );
  });

  it("selects Markdown when it is preferred over HTML", () => {
    expect(
      negotiatePageRepresentation("text/html;q=0.5, text/markdown;q=0.9"),
    ).toBe("markdown");
  });

  it("keeps HTML as the browser-friendly default for wildcards", () => {
    expect(negotiatePageRepresentation("*/*")).toBe("html");
    expect(negotiatePageRepresentation("text/*")).toBe("html");
  });

  it("honors an explicit preference for HTML", () => {
    expect(negotiatePageRepresentation("text/html, text/markdown;q=0.5")).toBe(
      "html",
    );
  });

  it("does not infer Markdown from a user agent", () => {
    expect(negotiatePageRepresentation(null)).toBe("html");
  });

  it("rejects requests for unsupported representations", () => {
    expect(negotiatePageRepresentation("application/json")).toBe(
      "not-acceptable",
    );
    expect(negotiatePageRepresentation("text/markdown;q=0")).toBe(
      "not-acceptable",
    );
  });

  it("lets an exact media range override a wildcard", () => {
    expect(negotiatePageRepresentation("*/*;q=1, text/markdown;q=0")).toBe(
      "html",
    );
    expect(negotiatePageRepresentation("*/*;q=0.8, text/markdown;q=0.8")).toBe(
      "markdown",
    );
  });
});

describe("addVaryAccept", () => {
  it("adds Accept without duplicating it", () => {
    const headers = new Headers({ Vary: "RSC" });
    addVaryAccept(headers);
    addVaryAccept(headers);
    expect(headers.get("Vary")).toBe("RSC, Accept");
  });
});
