# Telegram notifications

The public ingestion app can notify one Telegram chat whenever a new secret is
saved to the moderation queue. Notifications contain the submitted text, the
optional `x-author` identity, and a link to the admin detail page. They fire on
submission, before approval. Published examples and placeholders are dropped
without creating database entries or sending notifications. Invalid, oversized,
and IP-denied submissions do not trigger notifications.

## Setup

1. Open [@BotFather](https://t.me/BotFather) in Telegram, use `/newbot`, and copy
   the bot token.
2. Open a private chat with your new bot and press **Start** or send `/start`.
3. On your own machine, set `TELEGRAM_BOT_TOKEN` and retrieve the chat ID:

   ```bash
   read -rs TELEGRAM_BOT_TOKEN
   export TELEGRAM_BOT_TOKEN
   curl --silent --show-error "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates"
   ```

   Use `result[].message.chat.id` from your `/start` message. For a group, add the
   bot and send a command mentioning it, then use that group's chat ID (including
   its minus sign). An existing webhook must be removed before using `getUpdates`.

4. Configure these server-side environment variables on the **public** Vercel
   project (`apps/public`):

   | Variable             | Value                                              |
   | -------------------- | -------------------------------------------------- |
   | `TELEGRAM_BOT_TOKEN` | Token from BotFather                               |
   | `TELEGRAM_CHAT_ID`   | Your private chat or group ID                      |
   | `TELEGRAM_ADMIN_URL` | Optional; defaults to `https://admin.nulldiary.io` |

5. Redeploy the public app, then share a secret through `/s/*`. You should receive
   a notification whose review link opens that secret in the admin app.

Keep the token in server environment configuration. Leave Telegram variables
unset in preview deployments unless you want preview submissions to notify you.
Both the token and chat ID must be present to enable notifications. Remove either
to disable them. The bot needs no webhook or polling process for notifications.

## Delivery behavior

Delivery is awaited after saving the message and ingestion event. Each API attempt
has a two-second timeout, with up to three attempts for network errors, server
errors, and short rate limits. Telegram `retry_after` delays of up to two seconds
are honored; longer delays stop delivery rather than holding ingestion open.
Permanent API errors are not retried.

Delivery is best effort: failed notifications log only the saved message ID and do
not fail the submission. There is no durable queue or later replay, so outages or
long rate limits can lose notifications. A timeout after Telegram accepted a
message can also produce a duplicate on retry.

Notifications use plain text, disable link previews, and truncate long author or
content fields to fit Telegram's message limit while keeping the review link.
