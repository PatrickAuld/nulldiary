import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp } from "../app.js";

const { mockPersistIngestion } = vi.hoisted(() => ({
  mockPersistIngestion: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../persistence.js", () => ({
  persistIngestion: mockPersistIngestion,
}));

// Mock uuidv7 since persistence imports it
vi.mock("uuidv7", () => ({ uuidv7: () => "mock-uuid" }));

const fakeDb = {} as never;

describe("ingest route", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    mockPersistIngestion.mockClear();
    app = createApp(fakeDb);
  });

  it("returns 200 for GET /s/hello", async () => {
    const res = await app.request("/s/hello");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
  });

  it("returns 200 for POST /s/ with JSON body", async () => {
    const res = await app.request("/s/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hi" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
  });

  it("returns 200 with failed status when no message found", async () => {
    const res = await app.request("/s/");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("failed");
  });

  it("returns 200 for header-based message", async () => {
    const res = await app.request("/s/", {
      headers: { "x-message": "from-header" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
  });

  it("returns 200 for query-based message", async () => {
    const res = await app.request("/s?message=from-query");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
  });

  it("calls persistIngestion with correct arguments", async () => {
    await app.request("/s/test-msg");

    expect(mockPersistIngestion).toHaveBeenCalledOnce();
    const [db, raw, parsed] = mockPersistIngestion.mock.calls[0];
    expect(db).toBe(fakeDb);
    expect(raw.path).toBe("/s/test-msg");
    expect(parsed).toEqual({
      message: "test-msg",
      status: "success",
      source: "path",
    });
  });

  it("accepts PUT method", async () => {
    const res = await app.request("/s/put-msg", { method: "PUT" });
    expect(res.status).toBe(200);
  });

  it("accepts DELETE method", async () => {
    const res = await app.request("/s/del-msg", { method: "DELETE" });
    expect(res.status).toBe(200);
  });

  it("accepts PATCH method", async () => {
    const res = await app.request("/s/patch-msg", { method: "PATCH" });
    expect(res.status).toBe(200);
  });

  it("returns 200 for bare /s with query", async () => {
    const res = await app.request("/s?secret=bare-query");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
  });
});
