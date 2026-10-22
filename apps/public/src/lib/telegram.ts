import type { SharedSecret } from "@nulldiary/ingestion";

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1).replace(/[\uD800-\uDBFF]$/u, "") + "…";
}

export async function notifyTelegram(secret: SharedSecret): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return;

  const adminUrl =
    process.env.TELEGRAM_ADMIN_URL || "https://admin.nulldiary.io";
  const reviewUrl = new URL(
    `/messages/${encodeURIComponent(secret.id)}`,
    adminUrl,
  );
  const heading = `New secret shared\nAuthor: ${truncate(secret.author || "anonymous", 256)}\n\n`;
  const footer = `\n\nReview: ${reviewUrl}`;
  const text =
    heading +
    truncate(secret.content, 4096 - heading.length - footer.length) +
    footer;
  const body = JSON.stringify({
    chat_id: chatId,
    text,
    link_preview_options: { is_disabled: true },
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    let code: number | "network" = "network";
    let retryAfter = 0;
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: AbortSignal.timeout(2000),
          cache: "no-store",
        },
      );
      const result = await response.json();
      if (response.ok && result.ok === true) return;
      code =
        typeof result.error_code === "number"
          ? result.error_code
          : response.status;
      retryAfter = result.parameters?.retry_after ?? 0;
    } catch {
      // Never propagate fetch errors containing the bot token in the URL.
    }

    const transient = code === "network" || code === 429 || code >= 500;
    if (!transient || attempt === 2 || retryAfter > 2) {
      throw new Error(`Telegram delivery failed (${code})`);
    }
    const delay = Math.max(250 * 2 ** attempt, retryAfter * 1000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
