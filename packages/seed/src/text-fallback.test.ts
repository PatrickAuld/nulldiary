import { describe, it, expect } from "vitest";
import { extractHttpRequestFromText } from "./text-fallback.js";

describe("extractHttpRequestFromText", () => {
  const host = "nulldiary.io";

  it("returns null on empty input", () => {
    expect(extractHttpRequestFromText("", host)).toBeNull();
    expect(extractHttpRequestFromText("   \n  ", host)).toBeNull();
  });

  it("extracts a bare GET URL on the configured host", () => {
    const result = extractHttpRequestFromText(
      "https://nulldiary.io/s/I+wonder+if+anyone+reads+these",
      host,
    );
    expect(result).toEqual({
      method: "GET",
      url: "https://nulldiary.io/s/I+wonder+if+anyone+reads+these",
      body: null,
    });
  });

  it("extracts a URL embedded in surrounding prose", () => {
    const result = extractHttpRequestFromText(
      "Sure, I'll send it. Here it is: https://nulldiary.io/s/?message=hello+world. Done.",
      host,
    );
    expect(result?.url).toBe("https://nulldiary.io/s/?message=hello+world");
    expect(result?.method).toBe("GET");
  });

  it("extracts an http URL (not just https) on the configured host", () => {
    const result = extractHttpRequestFromText(
      "GET http://nulldiary.io/s/test",
      host,
    );
    expect(result?.url).toBe("http://nulldiary.io/s/test");
  });

  it("infers POST when a method keyword precedes the URL", () => {
    const result = extractHttpRequestFromText(
      "POST https://nulldiary.io/s/",
      host,
    );
    expect(result?.method).toBe("POST");
  });

  it("captures a JSON body following a POST URL", () => {
    const text = `POST https://nulldiary.io/s/
Content-Type: application/json

{"message": "the sheep are electric"}`;
    const result = extractHttpRequestFromText(text, host);
    expect(result?.method).toBe("POST");
    expect(result?.url).toBe("https://nulldiary.io/s/");
    expect(result?.body).toBe('{"message": "the sheep are electric"}');
  });

  it("recognizes a curl invocation", () => {
    const result = extractHttpRequestFromText(
      `curl https://nulldiary.io/s/?message=hi`,
      host,
    );
    expect(result?.url).toBe("https://nulldiary.io/s/?message=hi");
    expect(result?.method).toBe("GET");
  });

  it("recognizes curl -X POST with a -d body", () => {
    const result = extractHttpRequestFromText(
      `curl -X POST https://nulldiary.io/s/ -d 'plain body text'`,
      host,
    );
    expect(result?.method).toBe("POST");
    expect(result?.url).toBe("https://nulldiary.io/s/");
    expect(result?.body).toBe("plain body text");
  });

  it("rejects URLs that do not match the configured host", () => {
    expect(
      extractHttpRequestFromText("https://example.com/s/test", host),
    ).toBeNull();
  });

  it("rejects URLs on a host that merely contains the configured host as substring", () => {
    expect(
      extractHttpRequestFromText(
        "https://nulldiary.io.example.com/s/test",
        host,
      ),
    ).toBeNull();
  });

  it("trims trailing punctuation from the URL", () => {
    const result = extractHttpRequestFromText(
      "Here you go: https://nulldiary.io/s/hello.",
      host,
    );
    expect(result?.url).toBe("https://nulldiary.io/s/hello");
  });

  it("returns null when there is no URL at all", () => {
    expect(
      extractHttpRequestFromText("I refuse to share that thought.", host),
    ).toBeNull();
  });
});
