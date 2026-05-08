import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleIngestion } from "./handle-ingestion.js";

const { mockPersistIngestion, mockCheckRateLimit, mockFindDupe } = vi.hoisted(
  () => ({
    mockPersistIngestion: vi.fn().mockResolvedValue(undefined),
    mockCheckRateLimit: vi.fn(),
    mockFindDupe: vi.fn(),
  }),
);
vi.mock("./persistence.js", () => ({
  persistIngestion: mockPersistIngestion,
}));
vi.mock("@nulldiary/moderation", () => ({
  checkRateLimit: mockCheckRateLimit,
  findDupeByContentHash: mockFindDupe,
}));

vi.mock("uuidv7", () => ({ uuidv7: () => "mock-uuid" }));

const fakeDb = {} as never;

function req(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

describe("handleIngestion", () => {
  beforeEach(() => {
    mockPersistIngestion.mockClear();
    mockCheckRateLimit.mockReset();
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 99,
      resetAt: new Date(),
    });
    mockFindDupe.mockReset();
    mockFindDupe.mockResolvedValue(null);
  });

  it("returns 200 for GET /s/hello", async () => {
    const res = await handleIngestion(req("/s/hello"), fakeDb);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
  });

  it("returns 200 for POST /s/ with JSON body", async () => {
    const res = await handleIngestion(
      req("/s/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hi" }),
      }),
      fakeDb,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
  });

  it("returns 200 with failed status when no message found", async () => {
    const res = await handleIngestion(req("/s/"), fakeDb);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("failed");
  });

  it("returns 200 for header-based message", async () => {
    const res = await handleIngestion(
      req("/s/", { headers: { "x-message": "from-header" } }),
      fakeDb,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
  });

  it("returns 200 for query-based message", async () => {
    const res = await handleIngestion(req("/s?message=from-query"), fakeDb);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
  });

  it("calls persistIngestion with correct arguments", async () => {
    await handleIngestion(req("/s/test-msg"), fakeDb);

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
    const res = await handleIngestion(
      req("/s/put-msg", { method: "PUT" }),
      fakeDb,
    );
    expect(res.status).toBe(200);
  });

  it("accepts DELETE method", async () => {
    const res = await handleIngestion(
      req("/s/del-msg", { method: "DELETE" }),
      fakeDb,
    );
    expect(res.status).toBe(200);
  });

  it("accepts PATCH method", async () => {
    const res = await handleIngestion(
      req("/s/patch-msg", { method: "PATCH" }),
      fakeDb,
    );
    expect(res.status).toBe(200);
  });

  it("returns 200 for bare /s with query", async () => {
    const res = await handleIngestion(req("/s?secret=bare-query"), fakeDb);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
  });

  it("auto-denies on dupe of denied: passes autoDecision to persistIngestion and returns 200", async () => {
    mockFindDupe.mockResolvedValueOnce({
      status: "denied",
      messageId: "prior-msg",
    });

    const res = await handleIngestion(req("/s/some-msg"), fakeDb);

    expect(res.status).toBe(200);
    expect(mockPersistIngestion).toHaveBeenCalledOnce();
    const [, , parsed, autoDecision] = mockPersistIngestion.mock.calls[0];
    expect(parsed).toMatchObject({ status: "success", message: "some-msg" });
    expect(autoDecision).toEqual({
      action: "denied",
      reason: "dupe_of_denied",
      actor: "system:auto-mod@v1",
    });
  });

  it("does not pass autoDecision when no dupe is found", async () => {
    mockFindDupe.mockResolvedValueOnce(null);

    await handleIngestion(req("/s/fresh-msg"), fakeDb);

    expect(mockPersistIngestion).toHaveBeenCalledOnce();
    const [, , , autoDecision] = mockPersistIngestion.mock.calls[0];
    expect(autoDecision).toBeUndefined();
  });

  it("fails open when the dupe lookup throws: still persists, no autoDecision", async () => {
    mockFindDupe.mockRejectedValueOnce(new Error("supabase exploded"));

    const res = await handleIngestion(req("/s/lookup-failed"), fakeDb);

    expect(res.status).toBe(200);
    expect(mockPersistIngestion).toHaveBeenCalledOnce();
    const [, , parsed, autoDecision] = mockPersistIngestion.mock.calls[0];
    expect(parsed).toMatchObject({
      status: "success",
      message: "lookup-failed",
    });
    expect(autoDecision).toBeUndefined();
  });

  it("does not pass autoDecision when dupe is pending (cluster work is later)", async () => {
    mockFindDupe.mockResolvedValueOnce({
      status: "pending",
      messageId: "prior-msg",
    });

    await handleIngestion(req("/s/dupe-of-pending"), fakeDb);

    expect(mockPersistIngestion).toHaveBeenCalledOnce();
    const [, , , autoDecision] = mockPersistIngestion.mock.calls[0];
    expect(autoDecision).toBeUndefined();
  });

  it("returns 429 and writes a rate_limited ingestion event with no message row", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(),
    });
    const dbWithRpc = {
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    } as never;

    const res = await handleIngestion(
      req("/s/over-limit", {
        headers: { "x-forwarded-for": "1.2.3.4" },
      }),
      dbWithRpc,
    );

    expect(res.status).toBe(429);

    expect(mockPersistIngestion).toHaveBeenCalledOnce();
    const [, , parsed] = mockPersistIngestion.mock.calls[0];
    expect(parsed).toEqual({
      message: null,
      status: "rate_limited",
      source: null,
    });
  });
});
