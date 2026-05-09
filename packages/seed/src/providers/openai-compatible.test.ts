import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAICompatibleProvider } from "./openai-compatible.js";

describe("OpenAICompatibleProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockJson(value: unknown, status = 200) {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(value), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
  }

  it("posts to {baseURL}/chat/completions with the correct Authorization header and model", async () => {
    mockJson({
      choices: [{ message: { role: "assistant", content: "ok" } }],
    });

    const provider = new OpenAICompatibleProvider({
      baseURL: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "test-model",
    });

    await provider.complete({
      messages: [{ role: "user", content: "hi" }],
      tools: [],
    });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer sk-test");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("test-model");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("strips a trailing slash on baseURL", async () => {
    mockJson({
      choices: [{ message: { role: "assistant", content: "ok" } }],
    });

    const provider = new OpenAICompatibleProvider({
      baseURL: "https://api.example.com/v1/",
      apiKey: "sk-test",
      model: "test-model",
    });

    await provider.complete({ messages: [], tools: [] });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
  });

  it("forwards tools in the request payload when provided", async () => {
    mockJson({
      choices: [{ message: { role: "assistant", content: "" } }],
    });

    const provider = new OpenAICompatibleProvider({
      baseURL: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "m",
    });

    const tools = [
      {
        type: "function" as const,
        function: {
          name: "make_http_request",
          description: "send",
          parameters: { type: "object", properties: {} },
        },
      },
    ];

    await provider.complete({ messages: [], tools });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.tools).toEqual(tools);
    expect(body.tool_choice).toBe("auto");
  });

  it("omits the tools field entirely when no tools are provided", async () => {
    mockJson({
      choices: [{ message: { role: "assistant", content: "" } }],
    });

    const provider = new OpenAICompatibleProvider({
      baseURL: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "m",
    });

    await provider.complete({ messages: [], tools: [] });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
  });

  it("parses a plain text response", async () => {
    mockJson({
      choices: [
        {
          message: { role: "assistant", content: "I am a thought." },
        },
      ],
    });

    const provider = new OpenAICompatibleProvider({
      baseURL: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "m",
    });

    const result = await provider.complete({ messages: [], tools: [] });
    expect(result.content).toBe("I am a thought.");
    expect(result.toolCalls).toEqual([]);
  });

  it("parses tool calls and decodes JSON-string arguments", async () => {
    mockJson({
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "tc1",
                type: "function",
                function: {
                  name: "make_http_request",
                  arguments:
                    '{"method":"GET","url":"https://nulldiary.io/s/hi"}',
                },
              },
            ],
          },
        },
      ],
    });

    const provider = new OpenAICompatibleProvider({
      baseURL: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "m",
    });

    const result = await provider.complete({ messages: [], tools: [] });
    expect(result.content).toBeNull();
    expect(result.toolCalls).toEqual([
      {
        name: "make_http_request",
        arguments: { method: "GET", url: "https://nulldiary.io/s/hi" },
      },
    ]);
  });

  it("throws when the upstream HTTP call fails", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("nope", { status: 500 }),
    );

    const provider = new OpenAICompatibleProvider({
      baseURL: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "m",
    });

    await expect(
      provider.complete({ messages: [], tools: [] }),
    ).rejects.toThrow(/500/);
  });
});
