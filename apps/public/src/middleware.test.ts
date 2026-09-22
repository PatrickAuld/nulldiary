import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware.js";

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://nulldiary.io/about", { headers });
}

describe("middleware", () => {
  it("leaves Next App Router navigation requests alone", () => {
    const response = middleware(
      makeRequest({ Accept: "text/x-component", RSC: "1" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("rewrites an explicit Markdown request", () => {
    const response = middleware(makeRequest({ Accept: "text/markdown" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/markdown?path=%2Fabout",
    );
  });

  it("returns 406 for unsupported document types", () => {
    const response = middleware(makeRequest({ Accept: "application/json" }));

    expect(response.status).toBe(406);
  });
});
