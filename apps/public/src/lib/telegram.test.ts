import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyTelegram } from "./telegram";

const secret = {
  id: "message-id",
  content: "<a secret> & *text*",
  author: "agent",
};
const fetchMock = vi.fn();

function response(body: unknown = { ok: true }, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("Telegram notifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset().mockResolvedValue(response());
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "123456");
    vi.stubEnv("TELEGRAM_ADMIN_URL", "https://admin.nulldiary.io/");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each(["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"])(
    "does nothing without %s",
    async (key) => {
      vi.stubEnv(key, "");
      await notifyTelegram(secret);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("sends plain text and a moderation link to the configured chat", async () => {
    await notifyTelegram(secret);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest-token/sendMessage");
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({
      chat_id: "123456",
      text: "New secret shared\nAuthor: agent\n\n<a secret> & *text*\n\nReview: https://admin.nulldiary.io/messages/message-id",
      link_preview_options: { is_disabled: true },
    });
  });

  it("bounds long Unicode content and author while retaining the review link", async () => {
    await notifyTelegram({
      ...secret,
      content: "😀".repeat(6000),
      author: "a".repeat(5000),
    });
    const { text } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(text.length).toBeLessThanOrEqual(4096);
    expect(text).toContain("…");
    expect(
      text.endsWith("https://admin.nulldiary.io/messages/message-id"),
    ).toBe(true);
    expect(text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u);
  });

  it("uses an anonymous author when none was supplied", async () => {
    await notifyTelegram({ ...secret, author: null });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toContain(
      "Author: anonymous",
    );
  });

  it("retries transient HTTP failures", async () => {
    fetchMock.mockResolvedValueOnce(response({ ok: false }, 503));
    const delivery = notifyTelegram(secret);
    await vi.runAllTimersAsync();
    await delivery;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("honors Telegram's rate limit delay", async () => {
    fetchMock.mockResolvedValueOnce(
      response({ ok: false, parameters: { retry_after: 1 } }, 429),
    );
    const delivery = notifyTelegram(secret);
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await delivery;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry permanent API errors, even with HTTP 200", async () => {
    fetchMock.mockResolvedValueOnce(
      response({ ok: false, error_code: 403, description: "private info" }),
    );
    await expect(notifyTelegram(secret)).rejects.toThrow(
      "Telegram delivery failed (403)",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops after three network failures without exposing the token", async () => {
    fetchMock.mockRejectedValue(
      new Error("https://api.telegram.org/bottest-token/sendMessage"),
    );
    const delivery = expect(notifyTelegram(secret)).rejects.toThrow(
      "Telegram delivery failed (network)",
    );
    await vi.runAllTimersAsync();
    await delivery;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not wait indefinitely for rate limits", async () => {
    fetchMock.mockResolvedValueOnce(
      response({ ok: false, parameters: { retry_after: 60 } }, 429),
    );
    await expect(notifyTelegram(secret)).rejects.toThrow(
      "Telegram delivery failed (429)",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
