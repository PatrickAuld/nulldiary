import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleIngestion } from "./handle-ingestion.js";

const { mockPersistIngestion } = vi.hoisted(() => ({
  mockPersistIngestion: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./persistence.js", () => ({
  persistIngestion: mockPersistIngestion,
}));

vi.mock("uuidv7", () => ({ uuidv7: () => "mock-uuid" }));

const fakeDb = {} as never;

function req(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

describe("handleIngestion", () => {
  beforeEach(() => {
    mockPersistIngestion.mockReset().mockResolvedValue({
      id: "saved-id",
      content: "saved secret",
      author: "agent",
    });
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

  it("awaits notification after persistence, passing the saved secret", async () => {
    const onSecretShared = vi.fn().mockResolvedValue(undefined);
    const res = await handleIngestion(req("/s/secret"), fakeDb, {
      onSecretShared,
    });
    expect(res.status).toBe(200);
    expect(onSecretShared).toHaveBeenCalledExactlyOnceWith({
      id: "saved-id",
      content: "saved secret",
      author: "agent",
    });
    expect(mockPersistIngestion.mock.invocationCallOrder[0]).toBeLessThan(
      onSecretShared.mock.invocationCallOrder[0],
    );
  });

  it.each(["/s/", `/s/${"a".repeat(513)}`])(
    "does not notify for rejected content: %s",
    async (path) => {
      mockPersistIngestion.mockResolvedValue(null);
      const onSecretShared = vi.fn();
      await handleIngestion(req(path), fakeDb, { onSecretShared });
      expect(onSecretShared).not.toHaveBeenCalled();
    },
  );

  it("does not notify for denied IPs", async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: true, error: null }) };
    const onSecretShared = vi.fn();
    const res = await handleIngestion(
      req("/s/secret", { headers: { "x-real-ip": "192.0.2.1" } }),
      db as never,
      { onSecretShared },
    );
    expect(res.status).toBe(403);
    expect(onSecretShared).not.toHaveBeenCalled();
  });

  it("does not notify when persistence fails", async () => {
    mockPersistIngestion.mockRejectedValueOnce(new Error("DB unavailable"));
    const onSecretShared = vi.fn();
    await expect(
      handleIngestion(req("/s/secret"), fakeDb, { onSecretShared }),
    ).rejects.toThrow("DB unavailable");
    expect(onSecretShared).not.toHaveBeenCalled();
  });

  it("keeps the successful response when notification fails and logs only the ID", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const onSecretShared = vi
        .fn()
        .mockRejectedValue(new Error("sensitive token"));
      const res = await handleIngestion(req("/s/secret"), fakeDb, {
        onSecretShared,
      });
      expect(res.status).toBe(200);
      expect(log).toHaveBeenCalledExactlyOnceWith(
        "Secret notification failed",
        { messageId: "saved-id" },
      );
    } finally {
      log.mockRestore();
    }
  });
});
