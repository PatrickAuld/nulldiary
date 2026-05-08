import { describe, it, expect, vi } from "vitest";
import { classifyToxicity } from "./toxicity.js";

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

function makeOkResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function makeFakeFetch(response: unknown | (() => Response)) {
  const calls: FetchCall[] = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (typeof response === "function") {
      return (response as () => Response)();
    }
    return makeOkResponse(response);
  });
  return { fetch: fetchFn as unknown as typeof fetch, calls };
}

describe("classifyToxicity", () => {
  it("maps OpenAI categories to our union, folding sub-categories by max", async () => {
    const { fetch } = makeFakeFetch({
      results: [
        {
          flagged: false,
          categories: {},
          category_scores: {
            sexual: 0.01,
            "sexual/minors": 0.02,
            hate: 0.1,
            "hate/threatening": 0.9,
            harassment: 0.4,
            "harassment/threatening": 0.5,
            "self-harm": 0.05,
            "self-harm/intent": 0.07,
            "self-harm/instructions": 0.06,
            violence: 0.2,
            "violence/graphic": 0.8,
            illicit: 0.3,
            "illicit/violent": 0.4,
          },
        },
      ],
    });

    const scores = await classifyToxicity("hello", { fetch, apiKey: "k" });

    expect(scores).toEqual({
      sexual: 0.01,
      sexual_minors: 0.02,
      hate: 0.9,
      harassment: 0.5,
      self_harm: 0.07,
      violence: 0.8,
      illicit: 0.4,
    });
  });

  it("sends correct headers and JSON body to the moderations endpoint", async () => {
    const { fetch, calls } = makeFakeFetch({
      results: [{ flagged: false, categories: {}, category_scores: {} }],
    });

    await classifyToxicity("the input text", { fetch, apiKey: "sk-test" });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.openai.com/v1/moderations");
    const init = calls[0].init!;
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer sk-test");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({
      model: "omni-moderation-latest",
      input: "the input text",
    });
  });

  it("throws after exhausting retries on 5xx", async () => {
    const fetchFn = vi.fn(
      async () => new Response("boom", { status: 500 }),
    ) as unknown as typeof fetch;

    await expect(
      classifyToxicity("x", { fetch: fetchFn, apiKey: "k", retries: 2 }),
    ).rejects.toThrow();

    // initial + 2 retries = 3 attempts
    expect(
      (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(3);
  });

  it("retries on AbortError (timeout) up to retries times", async () => {
    let attempts = 0;
    const fetchFn = vi.fn(async () => {
      attempts += 1;
      if (attempts < 2) {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      }
      return makeOkResponse({
        results: [
          { flagged: false, categories: {}, category_scores: { hate: 0.1 } },
        ],
      });
    }) as unknown as typeof fetch;

    const scores = await classifyToxicity("x", {
      fetch: fetchFn,
      apiKey: "k",
      retries: 2,
      timeoutMs: 10,
    });
    expect(scores).toEqual({ hate: 0.1 });
    expect(attempts).toBe(2);
  });
});
