import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeProxyTool, PROXY_TOOL_DEFINITION } from "./proxy-tool.js";

describe("PROXY_TOOL_DEFINITION", () => {
  it("declares the make_http_request tool name", () => {
    expect(PROXY_TOOL_DEFINITION.function.name).toBe("make_http_request");
  });
});

describe("makeProxyTool", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockUpstream(status = 200, body = '{"status":"success"}') {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(body, {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
  }

  it("forwards a GET request to the URL the model provided", async () => {
    mockUpstream();

    const proxy = makeProxyTool({
      seedHeaders: {
        batch: "b1",
        run: "r1",
        model: "m1",
        skill_version: "2.0",
      },
    });

    const result = await proxy.invoke({
      method: "GET",
      url: "http://localhost:3000/s/hello",
    });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:3000/s/hello");
    expect(init.method).toBe("GET");
    expect(result.status).toBe(200);
    expect(result.body).toBe('{"status":"success"}');
  });

  it("injects the four x-seed-* headers on every forwarded request", async () => {
    mockUpstream();

    const proxy = makeProxyTool({
      seedHeaders: {
        batch: "batch-2026-05-08-01",
        run: "anthropic-opus",
        model: "claude-opus-4-7",
        skill_version: "2.0",
      },
    });

    await proxy.invoke({
      method: "POST",
      url: "https://nulldiary.io/s/",
      body: '{"message":"hi"}',
      headers: { "content-type": "application/json" },
    });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;

    expect(headers["x-seed-batch"]).toBe("batch-2026-05-08-01");
    expect(headers["x-seed-run"]).toBe("anthropic-opus");
    expect(headers["x-seed-model"]).toBe("claude-opus-4-7");
    expect(headers["x-seed-skill-version"]).toBe("2.0");
    // Original model-supplied header preserved.
    expect(headers["content-type"]).toBe("application/json");
    expect(init.body).toBe('{"message":"hi"}');
    expect(init.method).toBe("POST");
  });

  it("does not let model-supplied x-seed-* headers override harness-injected ones", async () => {
    mockUpstream();

    const proxy = makeProxyTool({
      seedHeaders: {
        batch: "real-batch",
        run: "real-run",
        model: "real-model",
        skill_version: "2.0",
      },
    });

    await proxy.invoke({
      method: "GET",
      url: "https://nulldiary.io/s/",
      headers: { "x-seed-batch": "fake-batch" },
    });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers["x-seed-batch"]).toBe("real-batch");
  });

  it("returns the upstream status and body for the model to see", async () => {
    mockUpstream(413, '{"status":"too_long"}');

    const proxy = makeProxyTool({
      seedHeaders: {
        batch: "b",
        run: "r",
        model: "m",
        skill_version: "2.0",
      },
    });

    const result = await proxy.invoke({
      method: "GET",
      url: "https://nulldiary.io/s/long",
    });

    expect(result).toEqual({ status: 413, body: '{"status":"too_long"}' });
  });

  it("returns a synthetic 0 status when the upstream call throws", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network down"),
    );

    const proxy = makeProxyTool({
      seedHeaders: {
        batch: "b",
        run: "r",
        model: "m",
        skill_version: "2.0",
      },
    });

    const result = await proxy.invoke({
      method: "GET",
      url: "https://nulldiary.io/s/x",
    });

    expect(result.status).toBe(0);
    expect(result.body).toMatch(/network down/);
  });
});
